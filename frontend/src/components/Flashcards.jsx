import { useState, useEffect } from "react";

export default function Flashcards({ api, token }) {
  const [cards, setCards] = useState([]);
  const [mode, setMode] = useState("list"); // list | study | add
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCards(); }, []);

  async function authFetch(url, opts = {}) {
    return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers } });
  }

  async function fetchCards() {
    const res = await authFetch(`${api}/flashcards`);
    if (res.ok) setCards(await res.json());
  }

  async function createCard(e) {
    e.preventDefault();
    setSaving(true);
    const res = await authFetch(`${api}/flashcards`, { method: "POST", body: JSON.stringify(form) });
    if (res.ok) {
      const card = await res.json();
      setCards((prev) => [card, ...prev]);
      setForm({ question: "", answer: "" });
      setMode("list");
    }
    setSaving(false);
  }

  async function deleteCard(id) {
    await authFetch(`${api}/flashcards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function startStudy() { setCurrent(0); setFlipped(false); setMode("study"); }
  function next() { setFlipped(false); setTimeout(() => setCurrent((i) => Math.min(i + 1, cards.length - 1)), 150); }
  function prev() { setFlipped(false); setTimeout(() => setCurrent((i) => Math.max(i - 1, 0)), 150); }

  if (mode === "study" && cards.length > 0) {
    const card = cards[current];
    return (
      <div className="flashcards-page">
        <div className="study-header">
          <button className="back-btn" onClick={() => setMode("list")}>← Back</button>
          <span className="study-progress">{current + 1} / {cards.length}</span>
        </div>
        <div className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)}>
          <div className="flashcard-inner">
            <div className="flashcard-front">
              <div className="card-label">Question</div>
              <div className="card-text">{card.question}</div>
              <div className="card-hint">Click to reveal answer</div>
            </div>
            <div className="flashcard-back">
              <div className="card-label">Answer</div>
              <div className="card-text">{card.answer}</div>
            </div>
          </div>
        </div>
        <div className="study-nav">
          <button className="btn-nav" onClick={prev} disabled={current === 0}>← Prev</button>
          <button className="btn-nav" onClick={next} disabled={current === cards.length - 1}>Next →</button>
        </div>
      </div>
    );
  }

  if (mode === "add") {
    return (
      <div className="flashcards-page">
        <div className="page-header">
          <h2>New Flashcard</h2>
          <button className="back-btn" onClick={() => setMode("list")}>← Back</button>
        </div>
        <form className="task-form" onSubmit={createCard}>
          <div className="form-group">
            <label>Question</label>
            <textarea rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. What does list.pop() do in Python?" required />
          </div>
          <div className="form-group">
            <label>Answer</label>
            <textarea rows={3} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="e.g. Removes and returns the last element of the list." required />
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Card"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flashcards-page">
      <div className="page-header">
        <div>
          <h2>Flashcards</h2>
          <p className="subtitle">{cards.length} card{cards.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {cards.length > 0 && <button className="btn-study" onClick={startStudy}>▶ Study</button>}
          <button className="btn-primary" onClick={() => setMode("add")}>+ Add Card</button>
        </div>
      </div>

      {cards.length === 0 && (
        <div className="empty-state">
          <p>No flashcards yet.</p>
          <p>Add cards to practice concepts you want to remember.</p>
        </div>
      )}

      <div className="cards-grid">
        {cards.map((card) => (
          <div key={card.id} className="card-item">
            <div className="card-item-q">{card.question}</div>
            <div className="card-item-a">{card.answer}</div>
            <button className="btn-delete" onClick={() => deleteCard(card.id)} title="Delete">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
