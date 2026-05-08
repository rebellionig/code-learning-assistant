import { useState, useEffect } from "react";

export default function Analytics({ api }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${api}/analytics`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="analytics-loading">Loading analytics...</div>;
  if (!data) return <div className="analytics-loading">Could not load analytics.</div>;

  const { tasks, hints, hypothesis, retention, daily_tasks, daily_hints } = data;

  // Build last 14 days labels
  const today = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  const taskMap = Object.fromEntries((daily_tasks || []).map((r) => [r.day, r.count]));
  const hintMap = Object.fromEntries((daily_hints || []).map((r) => [r.day, r.count]));

  const maxVal = Math.max(
    ...last14.map((d) => Math.max(taskMap[d] || 0, hintMap[d] || 0)),
    1
  );

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h2>Analytics</h2>
        <p className="subtitle">Hypothesis test data</p>
      </div>

      {/* Hypothesis result banner */}
      <div className={`hypothesis-banner ${hypothesis.confirmed ? "confirmed" : "pending"}`}>
        <div className="hyp-icon">{hypothesis.confirmed ? "✓" : "⏳"}</div>
        <div className="hyp-text">
          <strong>Core Hypothesis: {hypothesis.confirmed ? "CONFIRMED" : "NOT YET CONFIRMED"}</strong>
          <p>
            {hypothesis.hint_completion_rate}% of users who used a hint completed the task
            (target: &gt;{hypothesis.target}%)
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard
          label="Task Completion Rate"
          value={`${tasks.completion_rate}%`}
          sub={`${tasks.completed} of ${tasks.total} tasks done`}
          color="green"
        />
        <StatCard
          label="Hint Usage Rate"
          value={hints.tasks_with_hints > 0 ? `${hints.tasks_with_hints} tasks` : "0"}
          sub={`${hints.total_used} total hints used`}
          color="yellow"
        />
        <StatCard
          label="Completed After Hint"
          value={`${hypothesis.completed_after_hint}`}
          sub={`${hypothesis.hint_completion_rate}% hint→complete rate`}
          color="accent"
        />
        <StatCard
          label="Day-7 Retention"
          value={retention.day7_retained ? "Yes ✓" : "Not yet"}
          sub={`${retention.active_days} active day${retention.active_days !== 1 ? "s" : ""} total`}
          color={retention.day7_retained ? "green" : "muted"}
        />
      </div>

      {/* Hints this week */}
      <div className="week-bar-wrap">
        <div className="week-bar-label">
          Hints used this week: <strong>{hints.this_week_used} / {hints.this_week_limit}</strong>
        </div>
        <div className="week-bar-track">
          <div
            className="week-bar-fill"
            style={{ width: `${(hints.this_week_used / hints.this_week_limit) * 100}%` }}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="chart-box">
        <div className="chart-title">Activity — last 14 days</div>
        <div className="chart-legend">
          <span className="legend-dot task-dot" /> Tasks created
          <span className="legend-dot hint-dot" /> Hints used
        </div>
        <div className="bar-chart">
          {last14.map((day) => {
            const tv = taskMap[day] || 0;
            const hv = hintMap[day] || 0;
            const label = day.slice(5); // MM-DD
            return (
              <div key={day} className="bar-group">
                <div className="bars">
                  <div
                    className="bar bar-task"
                    style={{ height: `${(tv / maxVal) * 100}%` }}
                    title={`${tv} task${tv !== 1 ? "s" : ""}`}
                  />
                  <div
                    className="bar bar-hint"
                    style={{ height: `${(hv / maxVal) * 100}%` }}
                    title={`${hv} hint${hv !== 1 ? "s" : ""}`}
                  />
                </div>
                <div className="bar-label">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="analytics-note">
        Data is stored locally in SQLite. Share screenshots of this page in your Hypothesis Test Report (Assignment 4, Part 3.2).
      </p>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
