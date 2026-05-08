import { useState } from "react";

const LANGUAGES = ["Python", "JavaScript", "Java", "C++", "TypeScript", "Go", "Rust"];

export default function TaskList({ tasks, onCreateTask, onSelectTask, onToggleComplete, onDeleteTask }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", language: "Python" });
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    await onCreateTask(form);
    setForm({ title: "", description: "", language: "Python" });
    setShowForm(false);
    setCreating(false);
  }

  const completed = tasks.filter((t) => t.completed);
  const active = tasks.filter((t) => !t.completed);

  return (
    <div className="task-list-page">
      <div className="page-header">
        <div>
          <h2>My Tasks</h2>
          <p className="subtitle">{active.length} active · {completed.length} completed</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Task"}
        </button>
      </div>

      {showForm && (
        <form className="task-form" onSubmit={handleSubmit}>
          <h3>Create a new coding task</h3>
          <div className="form-group">
            <label>Task title *</label>
            <input
              type="text"
              placeholder="e.g. Write a function to reverse a string"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description / what you need to do</label>
            <textarea
              placeholder="Describe the problem in more detail..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            >
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Task"}
          </button>
        </form>
      )}

      {tasks.length === 0 && !showForm && (
        <div className="empty-state">
          <p>No tasks yet.</p>
          <p>Create your first coding task to get started.</p>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h3 className="section-label">Active</h3>
          <div className="task-cards">
            {active.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={() => onSelectTask(task)}
                onToggle={() => onToggleComplete(task.id, true)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h3 className="section-label">Completed</h3>
          <div className="task-cards">
            {completed.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={() => onSelectTask(task)}
                onToggle={() => onToggleComplete(task.id, false)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskCard({ task, onSelect, onToggle, onDelete }) {
  return (
    <div className={`task-card ${task.completed ? "completed" : ""}`}>
      <div className="task-card-main" onClick={onSelect}>
        <div className="task-card-title">{task.title}</div>
        {task.description && (
          <div className="task-card-desc">{task.description}</div>
        )}
        <div className="task-card-meta">
          <span className="lang-tag">{task.language}</span>
          {task.hint_count > 0 && (
            <span className="hint-count">💡 {task.hint_count} hint{task.hint_count !== 1 ? "s" : ""} used</span>
          )}
        </div>
      </div>
      <div className="task-card-actions">
        <button
          className={`btn-check ${task.completed ? "checked" : ""}`}
          onClick={onToggle}
          title={task.completed ? "Mark as active" : "Mark as done"}
        >
          {task.completed ? "↩" : "✓"}
        </button>
        <button className="btn-delete" onClick={onDelete} title="Delete">✕</button>
      </div>
    </div>
  );
}
