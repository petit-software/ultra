"use strict";
const electron = require("electron");
const path = require("path");
const nodePty = require("node-pty");
const os = require("os");
const fs = require("fs");
const chokidar = require("chokidar");
const child_process = require("child_process");
const shell = os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/zsh";
const sessions = /* @__PURE__ */ new Map();
function createPty(win, id, opts = {}) {
  if (sessions.has(id)) return;
  const cwd = opts.cwd && opts.cwd.length > 0 ? opts.cwd : os.homedir();
  const isWin = os.platform() === "win32";
  const args = opts.command && opts.command.trim() ? isWin ? ["-NoLogo", "-Command", opts.command] : ["-l", "-c", `exec ${opts.command}`] : [];
  const pty = nodePty.spawn(shell, args, {
    name: "xterm-color",
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    cwd,
    env: { ...process.env, TERM: "xterm-256color" }
  });
  pty.onData((data) => {
    if (!win.isDestroyed()) win.webContents.send("pty:data", { id, data });
  });
  pty.onExit(({ exitCode }) => {
    if (!win.isDestroyed()) win.webContents.send("pty:exit", { id, exitCode });
    sessions.delete(id);
  });
  sessions.set(id, { pty, cwd });
}
function writePty(id, data) {
  sessions.get(id)?.pty.write(data);
}
function resizePty(id, cols, rows) {
  const s = sessions.get(id);
  if (!s) return;
  try {
    s.pty.resize(Math.max(cols, 1), Math.max(rows, 1));
  } catch {
  }
}
function killPty(id) {
  const s = sessions.get(id);
  if (!s) return;
  try {
    s.pty.kill();
  } catch {
  }
  sessions.delete(id);
}
function killAllPty() {
  for (const id of [...sessions.keys()]) killPty(id);
}
const file = () => path.join(electron.app.getPath("userData"), "projects.json");
async function loadWorkspace() {
  try {
    const raw = await fs.promises.readFile(file(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function saveWorkspace(data) {
  try {
    await fs.promises.writeFile(file(), JSON.stringify(data, null, 2), "utf8");
  } catch {
  }
}
const IGNORED = /* @__PURE__ */ new Set([".git", "node_modules", ".DS_Store", "out", "dist", ".cache"]);
const MAX_PREVIEW_BYTES = 512 * 1024;
async function listDir(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const entries = [];
  for (const d of dirents) {
    if (IGNORED.has(d.name)) continue;
    entries.push({ name: d.name, path: path.join(dir, d.name), isDir: d.isDirectory() });
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}
async function readFilePreview(path2) {
  const stat = await fs.promises.stat(path2);
  if (stat.size > MAX_PREVIEW_BYTES) {
    return { content: "", truncated: false, tooLarge: true };
  }
  const buf = await fs.promises.readFile(path2);
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return { content: "", truncated: false, tooLarge: true };
  return { content: buf.toString("utf8"), truncated: false, tooLarge: false };
}
async function expandToFiles(paths, cap = 500) {
  const out = [];
  const walk = async (p) => {
    if (out.length >= cap) return;
    let stat;
    try {
      stat = await fs.promises.stat(p);
    } catch {
      return;
    }
    if (stat.isFile()) {
      out.push(p);
      return;
    }
    if (!stat.isDirectory()) return;
    let entries;
    try {
      entries = await fs.promises.readdir(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of entries) {
      if (out.length >= cap) break;
      if (IGNORED.has(d.name)) continue;
      const child = path.join(p, d.name);
      if (d.isDirectory()) await walk(child);
      else if (d.isFile()) out.push(child);
    }
  };
  for (const p of paths) {
    if (out.length >= cap) break;
    await walk(p);
  }
  return [...new Set(out)];
}
async function createFile(path$1) {
  try {
    await fs.promises.mkdir(path.join(path$1, ".."), { recursive: true });
    await fs.promises.writeFile(path$1, "", { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}
async function createDir(path2) {
  try {
    await fs.promises.mkdir(path2, { recursive: true });
    return true;
  } catch {
    return false;
  }
}
async function rename(oldPath, newPath) {
  if (oldPath === newPath) return true;
  try {
    try {
      await fs.promises.access(newPath);
      return false;
    } catch {
    }
    await fs.promises.rename(oldPath, newPath);
    return true;
  } catch {
    return false;
  }
}
const watchers = /* @__PURE__ */ new Map();
function watchRoot(win, root) {
  if (watchers.has(root)) return;
  const watcher = chokidar.watch(root, {
    ignored: (p) => IGNORED.has(path.basename(p)),
    ignoreInitial: true,
    depth: 6,
    persistent: true
  });
  let timer = null;
  const ping = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.send("fs:changed", { root });
    }, 200);
  };
  watcher.on("add", ping).on("unlink", ping).on("addDir", ping).on("unlinkDir", ping);
  watchers.set(root, watcher);
}
function unwatchRoot(root) {
  const w = watchers.get(root);
  if (!w) return;
  void w.close();
  watchers.delete(root);
}
function unwatchAll() {
  for (const root of [...watchers.keys()]) unwatchRoot(root);
}
function probeCommand(command) {
  const bin = command.trim().split(/\s+/)[0];
  if (!bin) return Promise.resolve(false);
  return new Promise((resolve) => {
    if (os.platform() === "win32") {
      child_process.execFile("where", [bin], (err) => resolve(!err));
      return;
    }
    const shell2 = process.env.SHELL || "/bin/zsh";
    child_process.execFile(shell2, ["-l", "-c", `command -v ${bin}`], (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}
let gitPathPromise = null;
function gitPath() {
  if (gitPathPromise) return gitPathPromise;
  gitPathPromise = new Promise((resolve) => {
    if (os.platform() === "win32") return resolve("git");
    const shell2 = process.env.SHELL || "/bin/zsh";
    child_process.execFile(shell2, ["-l", "-c", "command -v git"], (err, stdout) => {
      const p = stdout?.trim();
      resolve(!err && p ? p : "git");
    });
  });
  return gitPathPromise;
}
async function run(cwd, args) {
  const bin = await gitPath();
  return new Promise((resolve) => {
    child_process.execFile(bin, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}
function parseStatus(stdout) {
  const tokens = stdout.split("\0");
  const files = [];
  let branch = null;
  let ahead = 0;
  let behind = 0;
  let hasUpstream = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (t.startsWith("## ")) {
      const info = t.slice(3);
      hasUpstream = info.includes("...");
      const name = info.split("...")[0].split(" ")[0];
      branch = name === "HEAD" ? "HEAD (detached)" : name;
      const a = info.match(/ahead (\d+)/);
      const b = info.match(/behind (\d+)/);
      if (a) ahead = parseInt(a[1], 10);
      if (b) behind = parseInt(b[1], 10);
      continue;
    }
    const x = t[0];
    const y = t[1];
    const path2 = t.slice(3);
    files.push({ path: path2, x, y });
    if (x === "R" || x === "C") i++;
  }
  return { branch, ahead, behind, hasUpstream, files };
}
async function getStatus(cwd) {
  const empty = {
    isRepo: false,
    branch: null,
    ahead: 0,
    behind: 0,
    hasUpstream: false,
    files: []
  };
  if (!cwd) return empty;
  const inside = await run(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.stdout.trim() !== "true") return empty;
  const res = await run(cwd, ["status", "--porcelain=v1", "-b", "-z"]);
  return { isRepo: true, ...parseStatus(res.stdout) };
}
const init = (cwd) => run(cwd, ["init"]).then((r) => ({ ok: r.ok, stderr: r.stderr }));
const stage = (cwd, file2) => run(cwd, ["add", "--", file2]).then(() => void 0);
const stageAll = (cwd) => run(cwd, ["add", "-A"]).then(() => void 0);
const unstage = (cwd, file2) => run(cwd, ["reset", "-q", "HEAD", "--", file2]).then(() => void 0);
async function discard(cwd, file2, untracked) {
  if (untracked) {
    await run(cwd, ["clean", "-f", "--", file2]);
  } else {
    await run(cwd, ["checkout", "--", file2]);
  }
}
const commit = (cwd, message) => run(cwd, ["commit", "-m", message]).then((r) => ({ ok: r.ok, stderr: r.stderr }));
async function branches(cwd) {
  const res = await run(cwd, ["branch", "--format=%(refname:short)"]);
  const all = res.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  const cur = await run(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return { current: cur.stdout.trim(), all };
}
const switchBranch = (cwd, name) => run(cwd, ["switch", name]).then((r) => ({ ok: r.ok, stderr: r.stderr }));
const createBranch = (cwd, name) => run(cwd, ["switch", "-c", name]).then((r) => ({ ok: r.ok, stderr: r.stderr }));
const push = (cwd) => run(cwd, ["push"]).then((r) => ({ ok: r.ok, stdout: r.stdout, stderr: r.stderr }));
const pull = (cwd) => run(cwd, ["pull"]).then((r) => ({ ok: r.ok, stdout: r.stdout, stderr: r.stderr }));
const fetch = (cwd) => run(cwd, ["fetch"]).then((r) => ({ ok: r.ok, stdout: r.stdout, stderr: r.stderr }));
async function diff(cwd, file2, staged) {
  const args = staged ? ["diff", "--staged", "--", file2] : ["diff", "--", file2];
  const res = await run(cwd, args);
  if (res.stdout.trim()) return res.stdout;
  if (!staged) {
    const show = await run(cwd, ["diff", "--no-index", "--", "/dev/null", file2]);
    return show.stdout;
  }
  return "";
}
async function log(cwd, limit = 50) {
  const sep = "";
  const res = await run(cwd, [
    "log",
    `-n${limit}`,
    `--format=%h${sep}%s${sep}%an${sep}%cr`
  ]);
  return res.stdout.split("\n").filter(Boolean).map((line) => {
    const [hash, subject, author, relative] = line.split(sep);
    return { hash, subject, author, relative };
  });
}
function openInEditor(command, path2) {
  const cmd = command.trim();
  if (!cmd) return false;
  try {
    if (os.platform() === "win32") {
      child_process.spawn("cmd", ["/c", `${cmd} "${path2}"`], { detached: true, stdio: "ignore" }).unref();
    } else {
      const shell2 = process.env.SHELL || "/bin/zsh";
      child_process.spawn(shell2, ["-l", "-c", `${cmd} "${path2.replace(/"/g, '\\"')}"`], {
        detached: true,
        stdio: "ignore"
      }).unref();
    }
    return true;
  } catch {
    return false;
  }
}
let mainWindow = null;
function applyDockIcon() {
  if (process.platform !== "darwin" || !electron.app.dock) return;
  const name = "icon-dark.png";
  const path$1 = electron.app.isPackaged ? path.join(process.resourcesPath, name) : path.join(electron.app.getAppPath(), "build", name);
  const img = electron.nativeImage.createFromPath(path$1);
  if (!img.isEmpty()) electron.app.dock.setIcon(img);
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: "#14161b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
      // node-pty data flows through main; renderer stays sandboxed-by-API
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  if (!electron.app.isPackaged) mainWindow.webContents.openDevTools({ mode: "detach" });
}
function registerIpc() {
  electron.ipcMain.on("pty:create", (e, { id, cwd, cols, rows, command }) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    if (win) createPty(win, id, { cwd, cols, rows, command });
  });
  electron.ipcMain.on("pty:input", (_e, { id, data }) => writePty(id, data));
  electron.ipcMain.on("pty:resize", (_e, { id, cols, rows }) => resizePty(id, cols, rows));
  electron.ipcMain.on("pty:kill", (_e, { id }) => killPty(id));
  electron.ipcMain.handle("dialog:pickDirectory", async (e) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    const res = await electron.dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"]
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });
  electron.ipcMain.handle("store:load", () => loadWorkspace());
  electron.ipcMain.handle("store:save", (_e, data) => saveWorkspace(data));
  electron.ipcMain.handle("fs:listDir", (_e, dir) => listDir(dir));
  electron.ipcMain.handle("fs:readFile", (_e, path2) => readFilePreview(path2));
  electron.ipcMain.handle("fs:expandToFiles", (_e, paths) => expandToFiles(paths));
  electron.ipcMain.handle("fs:createFile", (_e, path2) => createFile(path2));
  electron.ipcMain.handle("fs:createDir", (_e, path2) => createDir(path2));
  electron.ipcMain.handle("fs:rename", (_e, oldPath, newPath) => rename(oldPath, newPath));
  electron.ipcMain.on("fs:watch", (e, root) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    if (win && root) watchRoot(win, root);
  });
  electron.ipcMain.on("fs:unwatch", (_e, root) => unwatchRoot(root));
  electron.ipcMain.on("fs:reveal", (_e, path2) => electron.shell.showItemInFolder(path2));
  electron.ipcMain.handle("fs:openPath", (_e, path2) => electron.shell.openPath(path2));
  electron.ipcMain.handle("fs:trash", async (_e, path2) => {
    try {
      await electron.shell.trashItem(path2);
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("agent:probe", (_e, command) => probeCommand(command));
  electron.ipcMain.handle("git:status", (_e, cwd) => getStatus(cwd));
  electron.ipcMain.handle("git:init", (_e, cwd) => init(cwd));
  electron.ipcMain.handle("git:stage", (_e, cwd, file2) => stage(cwd, file2));
  electron.ipcMain.handle("git:stageAll", (_e, cwd) => stageAll(cwd));
  electron.ipcMain.handle("git:unstage", (_e, cwd, file2) => unstage(cwd, file2));
  electron.ipcMain.handle(
    "git:discard",
    (_e, cwd, file2, untracked) => discard(cwd, file2, untracked)
  );
  electron.ipcMain.handle("git:commit", (_e, cwd, message) => commit(cwd, message));
  electron.ipcMain.handle("git:branches", (_e, cwd) => branches(cwd));
  electron.ipcMain.handle("git:switch", (_e, cwd, name) => switchBranch(cwd, name));
  electron.ipcMain.handle(
    "git:createBranch",
    (_e, cwd, name) => createBranch(cwd, name)
  );
  electron.ipcMain.handle("git:push", (_e, cwd) => push(cwd));
  electron.ipcMain.handle("git:pull", (_e, cwd) => pull(cwd));
  electron.ipcMain.handle("git:fetch", (_e, cwd) => fetch(cwd));
  electron.ipcMain.handle(
    "git:diff",
    (_e, cwd, file2, staged) => diff(cwd, file2, staged)
  );
  electron.ipcMain.handle("git:log", (_e, cwd) => log(cwd));
  electron.ipcMain.handle(
    "editor:open",
    (_e, command, path2) => openInEditor(command, path2)
  );
  electron.ipcMain.on("theme:setNative", (_e, mode) => {
    electron.nativeTheme.themeSource = mode === "dark" ? "dark" : "light";
  });
}
electron.app.whenReady().then(() => {
  registerIpc();
  applyDockIcon();
  electron.nativeTheme.on("updated", applyDockIcon);
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  killAllPty();
  unwatchAll();
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  killAllPty();
  unwatchAll();
});
