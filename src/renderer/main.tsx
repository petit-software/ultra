import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import '@xterm/xterm/css/xterm.css'

// Prevent the window from navigating to a file:// URL when a file is dropped
// outside our explicit drop zones. The Context panel handles its own drops.
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

// On macOS the window itself is transparent and the renderer paints the
// rounded window surface (see main/index.ts). Square it off in fullscreen.
if (navigator.userAgent.includes('Macintosh')) {
  document.documentElement.classList.add('mac')
  window.api.window.onFullScreen((fs) =>
    document.documentElement.classList.toggle('fullscreen', fs)
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
