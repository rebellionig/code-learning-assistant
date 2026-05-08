import { useState, useEffect } from "react";
import TaskList from "./components/TaskList";
import TaskDetail from "./components/TaskDetail";
import Analytics from "./components/Analytics";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [hintStatus, setHintStatus] = useState({ used: 0, limit: 3, remaining: 3 });
  const [view, setView] = useState("list"); // "list" | "detail" | "analytics"

  useEffect(() => {
    fetchTasks();
    fetchHintStatus();
  }, []);

  async function fetchTasks() {
    const res = await fetch(`${API}/tasks`);
    const data = await res.json();
    setTasks(data);
  }

  async function fetchHintStatus() {
    const res = await fetch(`${API}/hints/status`);
    const data = await res.json();
    setHintStatus(data);
  }

  async function createTask(taskData) {
    const res = await fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    });
    const newTask = await res.json();
    setTasks((prev) => [newTask, ...prev]);
  }

  async function toggleComplete(taskId, completed) {
    const res = await fetch(`${API}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    if (selectedTask?.id === taskId) setSelectedTask(updated);
  }

  async function deleteTask(taskId) {
    await fetch(`${API}/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
      setView("list");
    }
  }

  function openTask(task) {
    setSelectedTask(task);
    setView("detail");
  }

  function onHintUsed(remaining) {
    setHintStatus((prev) => ({ ...prev, remaining, used: prev.limit - remaining }));
    fetchTasks();
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {view === "detail" && (
            <button className="back-btn" onClick={() => setView("list")}>← Back</button>
          )}
          <h1 className="logo">⚡ Code Learning Assistant</h1>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-btn ${view === "list" || view === "detail" ? "active" : ""}`}
            onClick={() => setView("list")}
          >Tasks</button>
          <button
            className={`nav-btn ${view === "analytics" ? "active" : ""}`}
            onClick={() => setView("analytics")}
          >📊 Analytics</button>
        </nav>
        <div className="hint-badge">
          💡 {hintStatus.remaining}/{hintStatus.limit} hints left
        </div>
      </header>
      <main className="app-main">
        {view === "list" && (
          <TaskList
            tasks={tasks}
            onCreateTask={createTask}
            onSelectTask={openTask}
            onToggleComplete={toggleComplete}
            onDeleteTask={deleteTask}
          />
        )}
        {view === "detail" && (
          <TaskDetail
            task={selectedTask}
            onToggleComplete={toggleComplete}
            onHintUsed={onHintUsed}
            hintStatus={hintStatus}
            api={API}
          />
        )}
        {view === "analytics" && <Analytics api={API} />}
      </main>
    </div>
  );
}
