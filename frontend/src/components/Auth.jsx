import { useState } from "react";

export default function Auth({ api, onAuth }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${api}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); }
      else { onAuth(data); }
    } catch (e) {
      setError("Network error — is the backend running?");
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="auth-logo">⚡ Code Learning Assistant</h1>
        <p className="auth-sub">Learn to code with AI-powered hints</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(null); }}>Log In</button>
          <button className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setError(null); }}>Register</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 6 characters" : "Your password"} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <p className="auth-note">Your data is stored securely. Only your email and a hashed password are saved. You can delete your account at any time from Settings.</p>
      </div>
    </div>
  );
}
