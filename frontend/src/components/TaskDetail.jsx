import { useState, useEffect } from "react";

export default function TaskDetail({ task, onToggleComplete, onHintUsed, hintStatus, api }) {
  const [hints, setHints] = useState([]);
  const [loadingHint, setLoadingHint] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (task) fetchHints();
  }, [task?.id]);

  async function fetchHints() {
    const res = await fetch(`${api}/tasks/${task.id}/hints`);
    const data = await res.json();
    setHints(data);
  }

  async function requestHint() {
    if (hintStatus.remaining <= 0) {
      setError("You've used all your hints for this week. They reset in 7 days.");
      return;
    }
    setLoadingHint(true);
    setError(null);
    try {
      const res = await fetch(`${api}/tasks/${task.id}/hints`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not get hint");
      } else {
        setHints((prev) => [...prev, data]);
        onHintUsed(data.hints_remaining);
      }
    } catch (e) {
      setError("Network error — is the backend running?");
    }
    setLoadingHint(false);
  }

  if (!task) return null;

  return (
    <div className="task-detail-page">
      {/* LEFT: Task area */}
      <div className="task-area">
        <div className="task-header">
          <div className="task-status-row">
            <span className={`status-dot ${task.completed ? "done" : "active"}`} />
            <span className="status-label">{task.completed ? "Completed" : "In Progress"}</span>
            <span className="lang-tag">{task.language}</span>
          </div>
          <h2 className="task-title">{task.title}</h2>
          {task.description && (
            <p className="task-description">{task.description}</p>
          )}
        </div>

        <div className="work-area">
          <h3>Your workspace</h3>
          <textarea
            className="code-editor"
            placeholder={`// Write your ${task.language} code here...\n// Try to solve the task yourself first.\n// Use the hint panel on the right if you get stuck.`}
            rows={16}
            spellCheck={false}
          />
        </div>

        <div className="task-footer">
          <button
            className={`btn-complete ${task.completed ? "undo" : ""}`}
            onClick={() => onToggleComplete(task.id, !task.completed)}
          >
            {task.completed ? "↩ Mark as Active" : "✓ Mark as Complete"}
          </button>
          {task.completed && (
            <span className="completed-badge">🎉 Task completed!</span>
          )}
        </div>
      </div>

      {/* RIGHT: Hint sidebar */}
      <aside className="hint-sidebar">
        <div className="hint-sidebar-header">
          <h3>💡 Hints</h3>
          <div className="hint-quota">
            <div
              className="quota-bar"
              style={{ "--used": hintStatus.used, "--total": hintStatus.limit }}
            >
              {[...Array(hintStatus.limit)].map((_, i) => (
                <div
                  key={i}
                  className={`quota-pip ${i < hintStatus.used ? "pip-used" : "pip-free"}`}
                />
              ))}
            </div>
            <span className="quota-label">
              {hintStatus.remaining} of {hintStatus.limit} left this week
            </span>
          </div>
        </div>

        <div className="hint-philosophy">
          <p>Try solving the task yourself first. Hints are Socratic — they point you in the right direction, not give you the answer.</p>
        </div>

        {hints.length > 0 && (
          <div className="hints-list">
            {hints.map((hint, i) => (
              <div key={hint.id} className="hint-card">
                <div className="hint-number">Hint #{i + 1}</div>
                <p className="hint-text">{hint.hint_text}</p>
                <p className="hint-disclaimer">⚠ Verify with official documentation.</p>
              </div>
            ))}
          </div>
        )}

        {error && <div className="hint-error">{error}</div>}

        {!task.completed && (
          <button
            className="btn-hint"
            onClick={requestHint}
            disabled={loadingHint || hintStatus.remaining <= 0}
          >
            {loadingHint
              ? "Getting hint..."
              : hintStatus.remaining <= 0
              ? "No hints remaining this week"
              : hints.length === 0
              ? "Get a hint"
              : "Get another hint"}
          </button>
        )}

        {task.completed && (
          <div className="sidebar-done">
            ✓ Task complete — well done!
          </div>
        )}
      </aside>
    </div>
  );
}
