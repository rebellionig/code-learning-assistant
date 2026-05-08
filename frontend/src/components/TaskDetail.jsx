import { useState, useEffect, useRef } from "react";

// Judge0 language IDs
const LANGUAGE_IDS = {
  Python: 71,
  JavaScript: 63,
  Java: 62,
  "C++": 54,
  TypeScript: 74,
  Go: 60,
  Rust: 73,
};

const JUDGE0_URL = "https://ce.judge0.com";

export default function TaskDetail({ task, onToggleComplete, onHintUsed, hintStatus, api, token }) {
  const [hints, setHints] = useState([]);
  const [loadingHint, setLoadingHint] = useState(false);
  const [error, setError] = useState(null);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  useEffect(() => {
    if (task) fetchHints();
    setCode("");
    setOutput(null);
    setRunError(null);
  }, [task?.id]);

  async function fetchHints() {
    const res = await fetch(`${api}/tasks/${task.id}/hints`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`${api}/tasks/${task.id}/hints`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
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

  async function runCode() {
    if (!code.trim()) return;
    setRunning(true);
    setOutput(null);
    setRunError(null);

    const langId = LANGUAGE_IDS[task.language] || 71;

    try {
      // Submit
      const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_code: code, language_id: langId }),
      });
      const { token } = await submitRes.json();

      // Poll for result
      let result = null;
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`);
        result = await res.json();
        if (result.status?.id > 2) break; // not queued/processing
      }

      if (!result) {
        setRunError("Timeout — try again");
        return;
      }

      const statusId = result.status?.id;
      if (statusId === 3) {
        // Accepted
        setOutput({ type: "success", text: result.stdout || "(no output)" });
      } else if (statusId === 6) {
        // Compilation error
        setOutput({ type: "error", text: result.compile_output || "Compilation error" });
      } else if ([4, 5, 7, 8, 9, 10, 11, 12].includes(statusId)) {
        // Runtime errors
        setOutput({ type: "error", text: result.stderr || result.message || `Error: ${result.status.description}` });
      } else {
        setOutput({ type: "error", text: result.stderr || result.message || "Unknown error" });
      }
    } catch (e) {
      setRunError("Could not connect to code runner. Check your internet connection.");
    }
    setRunning(false);
  }

  if (!task) return null;

  const langSupported = !!LANGUAGE_IDS[task.language];

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
          {task.description && <p className="task-description">{task.description}</p>}
        </div>

        <div className="work-area">
          <div className="work-area-header">
            <h3>Your workspace</h3>
            {langSupported && (
              <button className="btn-run" onClick={runCode} disabled={running || !code.trim()}>
                {running ? "⏳ Running..." : "▶ Run Code"}
              </button>
            )}
          </div>
          <textarea
            className="code-editor"
            placeholder={`# Write your ${task.language} code here...\n# Try to solve the task yourself first.\n# Use the hint panel on the right if you get stuck.`}
            rows={16}
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {/* Output panel */}
        {(output || runError || running) && (
          <div className={`output-panel ${output?.type === "error" ? "output-error" : output?.type === "success" ? "output-success" : ""}`}>
            <div className="output-header">
              {running && "⏳ Running..."}
              {output?.type === "success" && "✓ Output"}
              {output?.type === "error" && "✕ Error"}
              {runError && "✕ Runner Error"}
            </div>
            <pre className="output-text">{output?.text || runError}</pre>
          </div>
        )}

        <div className="task-footer">
          <button
            className={`btn-complete ${task.completed ? "undo" : ""}`}
            onClick={() => onToggleComplete(task.id, !task.completed)}
          >
            {task.completed ? "↩ Mark as Active" : "✓ Mark as Complete"}
          </button>
          {task.completed && <span className="completed-badge">🎉 Task completed!</span>}
        </div>
      </div>

      {/* RIGHT: Hint sidebar */}
      <aside className="hint-sidebar">
        <div className="hint-sidebar-header">
          <h3>💡 Hints</h3>
          <div className="hint-quota">
            <div className="quota-bar">
              {[...Array(hintStatus.limit)].map((_, i) => (
                <div key={i} className={`quota-pip ${i < hintStatus.used ? "pip-used" : "pip-free"}`} />
              ))}
            </div>
            <span className="quota-label">{hintStatus.remaining} of {hintStatus.limit} left this week</span>
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
            {loadingHint ? "Getting hint..." : hintStatus.remaining <= 0 ? "No hints remaining this week" : hints.length === 0 ? "Get a hint" : "Get another hint"}
          </button>
        )}

        {task.completed && <div className="sidebar-done">✓ Task complete — well done!</div>}
      </aside>
    </div>
  );
}
