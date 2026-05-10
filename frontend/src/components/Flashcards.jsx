import { useState, useEffect } from "react";

export default function Flashcards({ api, token }) {
  const [cards, setCards] = useState([]);
  const [dueCards, setDueCards] = useState([]);
  const [mode, setMode] = useState("list"); // list | study | study-due | add
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCards(); fetchDue(); }, []);

  async function authFetch(url, opts = {}) {
    return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers } });
  }

  async function fetchCards() {
    const res = await authFetch(`${api}/flashcards`);
    if (res.ok) setCards(await res.json());
  }

  async function fetchDue() {
    const res = await authFetch(`${api}/flashcards/due`);
    if (res.ok) setDueCards(await res.json());
  }

  async function createCard(e) {
    e.preventDefault();
    setSaving(true);
    const res = await authFetch(`${api}/flashcards`, { method: "POST", body: JSON.stringify(form) });
    if (res.ok) {
      await fetchCards();
      await fetchDue();
      setForm({ question: "", answer: "" });
      setMode("list");
    }
    setSaving(false);
  }

  async function deleteCard(id) {
    await authFetch(`${api}/flashcards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
    setDueCards((prev) => prev.filter((c) => c.id !== id));
  }

  async function reviewCard(cardId, result) {
    await authFetch(`${api}/flashcards/${cardId}/review`, {
      method: "POST",
      body: JSON.stringify({ result })
    });
    // Move to next card
    const studyList = mode === "study-due" ? dueCards : cards;
    if (current + 1 < studyList.length) {
      setFlipped(false);
      setTimeout(() => setCurrent((i) => i + 1), 150);
    } else {
      // Done
      await fetchCards();
      await fetchDue();
      setMode("list");
      setCurrent(0);
    }
  }

  function startStudy(isDue = false) {
    setCurrent(0);
    setFlipped(false);
    setMode(isDue ? "study-due" : "study");
  }

  function next(studyList) {
    setFlipped(false);
    setTimeout(() => setCurrent((i) => Math.min(i + 1, studyList.length - 1)), 150);
  }

  function prev() {
    setFlipped(false);
    setTimeout(() => setCurrent((i) => Math.max(i - 1, 0)), 150);
  }

  const studyList = mode === "study-due" ? dueCards : cards;

  // STUDY MODE
  if ((mode === "study" || mode === "study-due") && studyList.length > 0) {
    const card = studyList[current];
    const isDueMode = mode === "study-due";
    return (
      <div className="flashcards-page">
        <div className="study-header">
          <button className="back-btn" onClick={() => setMode("list")}>← Back</button>
          <span className="study-progress">
            {isDueMode ? "📅 Review" : "📚 Study"} — {current + 1} / {studyList.length}
          </span>
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
              {card.review_count > 0 && (
                <div className="card-hint">Reviewed {card.review_count} time{card.review_count !== 1 ? "s" : ""}</div>
              )}
            </div>
          </div>
        </div>

        {isDueMode && flipped ? (
          // Spaced repetition buttons
          <div className="review-buttons">
            <button className="btn-dontknow" onClick={() => reviewCard(card.id, "dontknow")}>
              ✕ Don't Know
              <span>Review again tomorrow</span>
            </button>
            <button className="btn-know" onClick={() => reviewCard(card.id, "know")}>
              ✓ Know It
              <span>Next review in {Math.min((card.interval_days || 1) * 2, 30)} days</span>
            </button>
          </div>
        ) : (
          <div className="study-nav">
            <button className="btn-nav" onClick={prev} disabled={current === 0}>← Prev</button>
            <button className="btn-nav" onClick={() => next(studyList)} disabled={current === studyList.length - 1}>Next →</button>
          </div>
        )}
      </div>
    );
  }

  // ADD MODE
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

  // LIST MODE
  return (
    <div className="flashcards-page">
      <div className="page-header">
        <div>
          <h2>Flashcards</h2>
          <p className="subtitle">{cards.length} card{cards.length !== 1 ? "s" : ""} · {dueCards.length} due for review</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {dueCards.length > 0 && (
            <button className="btn-due" onClick={() => startStudy(true)}>
              📅 Review Due ({dueCards.length})
            </button>
          )}
          {cards.length > 0 && <button className="btn-study" onClick={() => startStudy(false)}>▶ Study All</button>}
          <button className="btn-primary" onClick={() => setMode("add")}>+ Add Card</button>
        </div>
      </div>

      {dueCards.length > 0 && (
        <div className="due-banner">
          📅 You have {dueCards.length} card{dueCards.length !== 1 ? "s" : ""} due for review today.
        </div>
      )}

      {cards.length === 0 && (
        <div className="empty-state">
          <p>No flashcards yet.</p>
          <p>Add cards to practice concepts you want to remember.</p>
        </div>
      )}

      <div className="cards-grid">
        {cards.map((card) => {
          const isDue = new Date(card.next_review) <= new Date();
          return (
            <div key={card.id} className={`card-item ${isDue ? "card-due" : ""}`}>
              <div className="card-item-q">{card.question}</div>
              <div className="card-item-a">{card.answer}</div>
              <div className="card-item-meta">
                {card.review_count > 0 && <span>Reviewed {card.review_count}x</span>}
                {isDue && <span className="due-tag">Due</span>}
              </div>
              <button className="btn-delete" onClick={() => deleteCard(card.id)} title="Delete">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
