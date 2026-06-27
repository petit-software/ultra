export default function FilePanel(): JSX.Element {
  return (
    <div className="sidebar">
      <div className="pane-header">
        <span className="pane-title">Files</span>
      </div>
      <div className="sidebar-body">
        <div className="placeholder">
          <p>File tree (M4)</p>
          <p className="muted">The active project&apos;s tree, live-watched, lands here.</p>
        </div>
      </div>
      <div className="pane-header pane-header-sub">
        <span className="pane-title">Context</span>
      </div>
      <div className="sidebar-body">
        <div className="placeholder">
          <p className="muted">Drag files here to pin them as agent context (M7).</p>
        </div>
      </div>
    </div>
  )
}
