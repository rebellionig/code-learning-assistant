import { useState, useEffect } from "react";
import TaskList from "./components/TaskList";
import TaskDetail from "./components/TaskDetail";
import Analytics from "./components/Analytics";
import Flashcards from "./components/Flashcards";
import IdeaGenerator from "./components/IdeaGenerator";
import Auth from "./components/Auth";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [hintStatus, setHintStatus] = useState({ used: 0, limit: 3, remaining: 3 });
  const [view, setView] = useState("list");

  useEffect(() => {
    if (token) {
      fetchMe();
      fetchTasks();
      fetchHintStatus();
    }
  }, [token]);

  async function authFetch(url, opts = {}) {
    return fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
    });
  }

  async function fetchMe() {
    const res = await authFetch(`${API}/auth/me`);
    if (res.ok) setUser(await res.json());
    else logout();
  }

  async function fetchTasks() {
    const res = await authFetch(`${API}/tasks`);
    if (res.ok) setTasks(await res.json());
  }

  async function fetchHintStatus() {
    const res = await authFetch(`${API}/hints/status`);
    if (res.ok) setHintStatus(await res.json());
  }

  function handleAuth(data) {
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setTasks([]);
    setView("list");
  }

  async function createTask(taskData) {
    const res = await authFetch(`${API}/tasks`, { method: "POST", body: JSON.stringify(taskData) });
    const newTask = await res.json();
    setTasks((prev) => [newTask, ...prev]);
  }

  async function toggleComplete(taskId, completed) {
    const res = await authFetch(`${API}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ completed }) });
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    if (selectedTask?.id === taskId) setSelectedTask(updated);
  }

  async function deleteTask(taskId) {
    await authFetch(`${API}/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) { setSelectedTask(null); setView("list"); }
  }

  async function updateSettings(settings) {
    const res = await authFetch(`${API}/auth/settings`, { method: "PATCH", body: JSON.stringify(settings) });
    if (res.ok) setUser(await res.json());
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all data? This cannot be undone.")) return;
    await authFetch(`${API}/auth/delete`, { method: "DELETE" });
    logout();
  }

  function openTask(task) { setSelectedTask(task); setView("detail"); }

  function onHintUsed(remaining) {
    setHintStatus((prev) => ({ ...prev, remaining, used: prev.limit - remaining }));
    fetchTasks();
  }

  if (!token) return <Auth api={API} onAuth={handleAuth} />;

  const showFlashcards = user?.flashcards_enabled !== false;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {view === "detail" && <button className="back-btn" onClick={() => setView("list")}>← Back</button>}
          <h1 className="logo">⚡ Code Learning Assistant</h1>
        </div>
        <nav className="header-nav">
          <button className={`nav-btn ${view === "list" || view === "detail" ? "active" : ""}`} onClick={() => setView("list")}>Tasks</button>
          {showFlashcards && <button className={`nav-btn ${view === "flashcards" ? "active" : ""}`} onClick={() => setView("flashcards")}>🃏 Flashcards</button>}
          <button className={`nav-btn ${view === "ideas" ? "active" : ""}`} onClick={() => setView("ideas")}>💡 Ideas</button>
          <button className={`nav-btn ${view === "analytics" ? "active" : ""}`} onClick={() => setView("analytics")}>📊 Analytics</button>
          <button className={`nav-btn ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>⚙</button>
        </nav>
        <div className="hint-badge">💡 {hintStatus.remaining}/{hintStatus.limit} hints left</div>
      </header>

      <main className="app-main">
        {view === "list" && <TaskList tasks={tasks} onCreateTask={createTask} onSelectTask={openTask} onToggleComplete={toggleComplete} onDeleteTask={deleteTask} />}
        {view === "detail" && <TaskDetail task={selectedTask} onToggleComplete={toggleComplete} onHintUsed={onHintUsed} hintStatus={hintStatus} api={API} token={token} />}
        {view === "flashcards" && <Flashcards api={API} token={token} />}
        {view === "ideas" && <IdeaGenerator api={API} token={token} />}
        {view === "analytics" && <Analytics api={API} token={token} />}
        {view === "settings" && <Settings user={user} onUpdate={updateSettings} onLogout={logout} onDelete={deleteAccount} />}
      </main>
    </div>
  );
}

function Settings({ user, onUpdate, onLogout, onDelete }) {
  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-label">Account</div>
            <div className="settings-value">{user?.email}</div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Flashcards</div>
            <div className="settings-sub">Show flashcard feature in navigation</div>
          </div>
          <button
            className={`toggle-btn ${user?.flashcards_enabled ? "on" : "off"}`}
            onClick={() => onUpdate({ flashcards_enabled: !user?.flashcards_enabled })}
          >
            {user?.flashcards_enabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      <div className="settings-actions">
        <button className="btn-logout" onClick={onLogout}>Log Out</button>
        <button className="btn-danger" onClick={onDelete}>Delete Account</button>
      </div>
    </div>
  );
}
