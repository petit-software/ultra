export default function AgentPanel(): JSX.Element {
  return (
    <div className="agent-pane">
      <div className="pane-header">
        <span className="pane-title">Agent</span>
        <span className="muted small">read-only loop arrives in M5</span>
      </div>
      <div className="agent-body">
        <div className="placeholder">
          <p className="muted">
            The agent conversation streams here — tool calls render as collapsible cards.
          </p>
        </div>
      </div>
      <div className="agent-input">
        <textarea placeholder="Ask the agent… (wired in M5)" rows={2} disabled />
        <button disabled>Send</button>
      </div>
    </div>
  )
}
