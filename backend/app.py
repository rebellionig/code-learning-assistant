import time
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
HINTS_PER_WEEK = 3

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
) if GROQ_API_KEY else None


def get_db():
    # Render PostgreSQL URLs start with postgres:// — psycopg2 needs postgresql://
    url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            language TEXT DEFAULT 'Python',
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS hints (
            id SERIAL PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            hint_text TEXT NOT NULL,
            server_ts BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    conn.commit()
    cur.close()
    conn.close()


def get_hints_this_week():
    conn = get_db()
    cur = conn.cursor()
    week_ago_ts = int(time.time()) - (7 * 24 * 3600)
    cur.execute("SELECT COUNT(*) as cnt FROM hints WHERE server_ts > %s", (week_ago_ts,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["cnt"]


# ── TASKS ──────────────────────────────────────────────────────────────────────

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.*, COUNT(h.id) as hint_count
        FROM tasks t LEFT JOIN hints h ON h.task_id = t.id
        GROUP BY t.id ORDER BY t.created_at DESC
    """)
    tasks = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(t) for t in tasks])


@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.json
    if not data or not data.get("title"):
        return jsonify({"error": "Title is required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO tasks (title, description, language) VALUES (%s, %s, %s) RETURNING *",
        (data["title"], data.get("description", ""), data.get("language", "Python"))
    )
    task = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return jsonify(dict(task)), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    if "completed" in data:
        cur.execute(
            "UPDATE tasks SET completed = %s WHERE id = %s RETURNING *",
            (bool(data["completed"]), task_id)
        )
    task = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not task:
        return jsonify({"error": "Not found"}), 404
    return jsonify(dict(task))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"ok": True})


# ── HINTS ──────────────────────────────────────────────────────────────────────

@app.route("/api/tasks/<int:task_id>/hints", methods=["GET"])
def get_hints(task_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM hints WHERE task_id = %s ORDER BY created_at ASC", (task_id,))
    hints = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(h) for h in hints])


@app.route("/api/tasks/<int:task_id>/hints", methods=["POST"])
def request_hint(task_id):
    used = get_hints_this_week()
    remaining = HINTS_PER_WEEK - used
    if remaining <= 0:
        return jsonify({"error": "Weekly hint limit reached", "limit": HINTS_PER_WEEK, "remaining": 0}), 429

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
    task = cur.fetchone()
    if not task:
        cur.close()
        conn.close()
        return jsonify({"error": "Task not found"}), 404
    task = dict(task)

    hint_text = generate_hint(task)

    cur.execute(
        "INSERT INTO hints (task_id, hint_text, server_ts) VALUES (%s, %s, %s) RETURNING *",
        (task_id, hint_text, int(time.time()))
    )
    hint = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        **dict(hint),
        "hints_used_this_week": used + 1,
        "hints_remaining": remaining - 1
    }), 201


@app.route("/api/hints/status", methods=["GET"])
def hint_status():
    used = get_hints_this_week()
    return jsonify({"used": used, "limit": HINTS_PER_WEEK, "remaining": max(0, HINTS_PER_WEEK - used)})


def generate_hint(task):
    if not client:
        import random
        mocks = [
            f"Try breaking '{task['title']}' into smaller steps. What is the very first thing that needs to happen?",
            f"Think about what data structure would best represent the problem in '{task['title']}'.",
            f"For '{task['title']}' in {task['language']}: look up the built-in functions available — there may already be something that handles part of this.",
        ]
        return random.choice(mocks)
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": (
                    "You are a programming tutor giving a beginner a Socratic hint — "
                    "NOT a solution. Point the student in the right direction without solving it. "
                    "Keep it under 3 sentences. End with a guiding question. Add: 'Verify with docs.'"
                )},
                {"role": "user", "content": (
                    f"Task: {task['title']}\nDescription: {task['description']}\nLanguage: {task['language']}\n\n"
                    "Give me a hint without giving away the answer."
                )}
            ],
            max_tokens=150,
            temperature=0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Hint unavailable right now. Try breaking the problem into smaller pieces — what is the first step? (Error: {str(e)[:60]})"


# ── ANALYTICS ──────────────────────────────────────────────────────────────────

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed FROM tasks")
    tasks_row = cur.fetchone()

    cur.execute("SELECT COUNT(*) as total_hints, COUNT(DISTINCT task_id) as tasks_with_hints FROM hints")
    hints_row = cur.fetchone()

    cur.execute("""
        SELECT COUNT(DISTINCT t.id) as completed_with_hint
        FROM tasks t JOIN hints h ON h.task_id = t.id WHERE t.completed = TRUE
    """)
    hypothesis_row = cur.fetchone()

    cur.execute("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM tasks WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day ASC
    """)
    daily_tasks = cur.fetchall()

    cur.execute("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM hints WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day ASC
    """)
    daily_hints = cur.fetchall()

    cur.execute("""
        SELECT DISTINCT DATE(created_at) as day FROM tasks
        UNION SELECT DISTINCT DATE(created_at) as day FROM hints
        ORDER BY day ASC
    """)
    days_active = cur.fetchall()

    cur.close()
    conn.close()

    total = tasks_row["total"] or 0
    completed = tasks_row["completed"] or 0
    total_hints = hints_row["total_hints"] or 0
    tasks_with_hints = hints_row["tasks_with_hints"] or 0
    completed_with_hint = hypothesis_row["completed_with_hint"] or 0

    hint_completion_rate = round(
        (completed_with_hint / tasks_with_hints * 100) if tasks_with_hints > 0 else 0, 1
    )

    days_list = [str(r["day"]) for r in days_active]
    day7_retained = False
    if len(days_list) >= 2:
        from datetime import date as ddate
        first = ddate.fromisoformat(days_list[0])
        for d in days_list[1:]:
            if (ddate.fromisoformat(d) - first).days <= 7:
                day7_retained = True
                break

    return jsonify({
        "tasks": {"total": total, "completed": completed,
                  "completion_rate": round(completed / total * 100, 1) if total > 0 else 0},
        "hints": {"total_used": total_hints, "tasks_with_hints": tasks_with_hints,
                  "this_week_used": get_hints_this_week(), "this_week_limit": HINTS_PER_WEEK},
        "hypothesis": {"completed_after_hint": completed_with_hint,
                       "hint_completion_rate": hint_completion_rate,
                       "target": 40, "confirmed": hint_completion_rate >= 40},
        "retention": {"active_days": len(days_list), "day7_retained": day7_retained},
        "daily_tasks": [{"day": str(r["day"]), "count": r["count"]} for r in daily_tasks],
        "daily_hints": [{"day": str(r["day"]), "count": r["count"]} for r in daily_hints],
    })


# ── RUN ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print("✓ Database initialised")
    print(f"✓ Hint limit: {HINTS_PER_WEEK} per week")
    print(f"✓ AI: {'connected (Groq)' if client else 'MOCK MODE'}")
    app.run(port=5001, debug=True)
