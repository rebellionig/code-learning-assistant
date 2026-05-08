import { useState } from "react";

const LANGUAGES = ["Python", "JavaScript", "Java", "C++", "TypeScript", "Go", "Rust"];
const DIFFICULTIES = { Beginner: "green", Intermediate: "yellow", Advanced: "red" };

export default function IdeaGenerator({ api, token }) {
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("Python");
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generate(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIdeas([]);
    try {
      const res = await fetch(`${api}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic, language }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not generate ideas");
      else setIdeas(data.ideas || []);
    } catch (e) {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="ideas-page">
      <div className="page-header">
        <div>
          <h2>Project Ideas</h2>
          <p className="subtitle">Get AI-generated project ideas to practice</p>
        </div>
      </div>

      <form className="task-form" onSubmit={generate}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "12px" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Topic (optional)</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. web scraping, games, data analysis..."
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: "12px" }}>
          {loading ? "Generating..." : "✨ Generate Ideas"}
        </button>
      </form>

      {error && <div className="hint-error" style={{ marginTop: "16px" }}>{error}</div>}

      {ideas.length > 0 && (
        <div className="ideas-list">
          {ideas.map((idea, i) => (
            <div key={i} className="idea-card">
              <div className="idea-header">
                <span className="idea-title">{idea.title}</span>
                <span className={`difficulty-tag diff-${(idea.difficulty || "Beginner").toLowerCase()}`}>
                  {idea.difficulty || "Beginner"}
                </span>
              </div>
              <p className="idea-desc">{idea.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
