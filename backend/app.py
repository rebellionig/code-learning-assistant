import time
import os
import jwt
import bcrypt
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from datetime import datetime, timedelta
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
HINTS_PER_WEEK = 3

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
) if GROQ_API_KEY else None


def get_db():
    url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    return psycopg2.connect(url, cursor_factory=RealDictCursor)


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            flashcards_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            language TEXT DEFAULT 'Python',
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS hints (
            id SERIAL PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            hint_text TEXT NOT NULL,
            server_ts BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS flashcards (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    conn.commit()
    cur.close()
    conn.close()


# ── AUTH HELPERS ───────────────────────────────────────────────────────────────

def make_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
        token = auth[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def get_hints_this_week(user_id):
    conn = get_db()
    cur = conn.cursor()
    week_ago_ts = int(time.time()) - (7 * 24 * 3600)
    cur.execute(
        "SELECT COUNT(*) as cnt FROM hints WHERE user_id = %s AND server_ts > %s",
        (user_id, week_ago_ts)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["cnt"]


# ── AUTH ROUTES ────────────────────────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400
    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    password_hash = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email, flashcards_enabled",
            (data["email"].lower().strip(), password_hash)
        )
        user = cur.fetchone()
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Email already registered"}), 409
    cur.close()
    conn.close()

    token = make_token(user["id"])
    return jsonify({"token": token, "user": dict(user)}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (data["email"].lower().strip(),))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not bcrypt.checkpw(data["password"].encode(), user["password_hash"].encode()):
        return jsonify({"error": "Invalid email or password"}), 401

    token = make_token(user["id"])
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "flashcards_enabled": user["flashcards_enabled"]}
    })


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def me():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, email, flashcards_enabled, created_at FROM users WHERE id = %s", (request.user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(dict(user))


@app.route("/api/auth/settings", methods=["PATCH"])
@require_auth
def update_settings():
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    if "flashcards_enabled" in data:
        cur.execute(
            "UPDATE users SET flashcards_enabled = %s WHERE id = %s RETURNING id, email, flashcards_enabled",
            (bool(data["flashcards_enabled"]), request.user_id)
        )
    user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return jsonify(dict(user))


@app.route("/api/auth/delete", methods=["DELETE"])
@require_auth
def delete_account():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = %s", (request.user_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"ok": True})


# ── TASKS ──────────────────────────────────────────────────────────────────────

@app.route("/api/tasks", methods=["GET"])
@require_auth
def get_tasks():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.*, COUNT(h.id) as hint_count
        FROM tasks t LEFT JOIN hints h ON h.task_id = t.id
        WHERE t.user_id = %s
        GROUP BY t.id ORDER BY t.created_at DESC
    """, (request.user_id,))
    tasks = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(t) for t in tasks])


@app.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    data = request.json
    if not data or not data.get("title"):
        return jsonify({"error": "Title is required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO tasks (user_id, title, description, language) VALUES (%s, %s, %s, %s) RETURNING *",
        (request.user_id, data["title"], data.get("description", ""), data.get("language", "Python"))
    )
    task = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return jsonify(dict(task)), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@require_auth
def update_task(task_id):
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    if "completed" in data:
        cur.execute(
            "UPDATE tasks SET completed = %s WHERE id = %s AND user_id = %s RETURNING *",
            (bool(data["completed"]), task_id, request.user_id)
        )
    task = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not task:
        return jsonify({"error": "Not found"}), 404
    return jsonify(dict(task))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@require_auth
def delete_task(task_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE id = %s AND user_id = %s", (task_id, request.user_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"ok": True})


# ── HINTS ──────────────────────────────────────────────────────────────────────

@app.route("/api/tasks/<int:task_id>/hints", methods=["GET"])
@require_auth
def get_hints(task_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM hints WHERE task_id = %s AND user_id = %s ORDER BY created_at ASC",
                (task_id, request.user_id))
    hints = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(h) for h in hints])


@app.route("/api/tasks/<int:task_id>/hints", methods=["POST"])
@require_auth
def request_hint(task_id):
    used = get_hints_this_week(request.user_id)
    remaining = HINTS_PER_WEEK - used
    if remaining <= 0:
        return jsonify({"error": "Weekly hint limit reached", "limit": HINTS_PER_WEEK, "remaining": 0}), 429

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tasks WHERE id = %s AND user_id = %s", (task_id, request.user_id))
    task = cur.fetchone()
    if not task:
        cur.close()
        conn.close()
        return jsonify({"error": "Task not found"}), 404
    task = dict(task)

    hint_text = generate_hint(task)

    cur.execute(
        "INSERT INTO hints (task_id, user_id, hint_text, server_ts) VALUES (%s, %s, %s, %s) RETURNING *",
        (task_id, request.user_id, hint_text, int(time.time()))
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
@require_auth
def hint_status():
    used = get_hints_this_week(request.user_id)
    return jsonify({"used": used, "limit": HINTS_PER_WEEK, "remaining": max(0, HINTS_PER_WEEK - used)})


# ── FLASHCARDS ─────────────────────────────────────────────────────────────────

@app.route("/api/flashcards", methods=["GET"])
@require_auth
def get_flashcards():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM flashcards WHERE user_id = %s ORDER BY created_at DESC", (request.user_id,))
    cards = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(c) for c in cards])


@app.route("/api/flashcards", methods=["POST"])
@require_auth
def create_flashcard():
    data = request.json
    if not data or not data.get("question") or not data.get("answer"):
        return jsonify({"error": "Question and answer required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO flashcards (user_id, question, answer) VALUES (%s, %s, %s) RETURNING *",
        (request.user_id, data["question"], data["answer"])
    )
    card = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return jsonify(dict(card)), 201


@app.route("/api/flashcards/<int:card_id>", methods=["DELETE"])
@require_auth
def delete_flashcard(card_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM flashcards WHERE id = %s AND user_id = %s", (card_id, request.user_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"ok": True})


# ── IDEA GENERATOR ─────────────────────────────────────────────────────────────

@app.route("/api/ideas", methods=["POST"])
@require_auth
def generate_ideas():
    data = request.json
    topic = data.get("topic", "")
    language = data.get("language", "Python")

    if not client:
        return jsonify({"ideas": [
            {"title": "Todo App", "description": f"Build a command-line todo manager in {language}.", "difficulty": "Beginner"},
            {"title": "Weather CLI", "description": f"Fetch and display weather data using a public API in {language}.", "difficulty": "Beginner"},
            {"title": "Text Adventure Game", "description": f"Create a simple text-based adventure game in {language}.", "difficulty": "Intermediate"},
            {"title": "File Organizer", "description": f"Script that automatically sorts files into folders by type in {language}.", "difficulty": "Intermediate"},
            {"title": "Budget Tracker", "description": f"Track income and expenses with CSV export in {language}.", "difficulty": "Intermediate"},
        ]})

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": (
                    "You are a programming project idea generator. "
                    "Return ONLY a JSON array of exactly 5 project ideas. "
                    "Each idea has: title (string), description (1-2 sentences), difficulty (Beginner/Intermediate/Advanced). "
                    "No markdown, no extra text — just the JSON array."
                )},
                {"role": "user", "content": f"Generate 5 project ideas for a {language} developer{' interested in ' + topic if topic else ''}. Mix of difficulties."}
            ],
            max_tokens=600,
            temperature=0.8
        )
        import json
        text = response.choices[0].message.content.strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        ideas = json.loads(text.strip())
        return jsonify({"ideas": ideas})
    except Exception as e:
        return jsonify({"error": f"Could not generate ideas: {str(e)[:100]}"}), 500


# ── ANALYTICS ──────────────────────────────────────────────────────────────────

@app.route("/api/analytics", methods=["GET"])
@require_auth
def get_analytics():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed FROM tasks WHERE user_id = %s", (request.user_id,))
    tasks_row = cur.fetchone()

    cur.execute("SELECT COUNT(*) as total_hints, COUNT(DISTINCT task_id) as tasks_with_hints FROM hints WHERE user_id = %s", (request.user_id,))
    hints_row = cur.fetchone()

    cur.execute("""
        SELECT COUNT(DISTINCT t.id) as completed_with_hint
        FROM tasks t JOIN hints h ON h.task_id = t.id
        WHERE t.completed = TRUE AND t.user_id = %s
    """, (request.user_id,))
    hypothesis_row = cur.fetchone()

    cur.execute("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM tasks WHERE user_id = %s AND created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day ASC
    """, (request.user_id,))
    daily_tasks = cur.fetchall()

    cur.execute("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM hints WHERE user_id = %s AND created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day ASC
    """, (request.user_id,))
    daily_hints = cur.fetchall()

    cur.execute("""
        SELECT DISTINCT DATE(created_at) as day FROM tasks WHERE user_id = %s
        UNION SELECT DISTINCT DATE(created_at) as day FROM hints WHERE user_id = %s
        ORDER BY day ASC
    """, (request.user_id, request.user_id))
    days_active = cur.fetchall()

    cur.close()
    conn.close()

    total = tasks_row["total"] or 0
    completed = tasks_row["completed"] or 0
    total_hints = hints_row["total_hints"] or 0
    tasks_with_hints = hints_row["tasks_with_hints"] or 0
    completed_with_hint = hypothesis_row["completed_with_hint"] or 0
    hint_completion_rate = round((completed_with_hint / tasks_with_hints * 100) if tasks_with_hints > 0 else 0, 1)

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
                  "this_week_used": get_hints_this_week(request.user_id), "this_week_limit": HINTS_PER_WEEK},
        "hypothesis": {"completed_after_hint": completed_with_hint, "hint_completion_rate": hint_completion_rate,
                       "target": 40, "confirmed": hint_completion_rate >= 40},
        "retention": {"active_days": len(days_list), "day7_retained": day7_retained},
        "daily_tasks": [{"day": str(r["day"]), "count": r["count"]} for r in daily_tasks],
        "daily_hints": [{"day": str(r["day"]), "count": r["count"]} for r in daily_hints],
    })


# ── DOCS LOADER & HINT GENERATOR ───────────────────────────────────────────────

def load_language_docs(language):
    lang_map = {"Python": "python", "JavaScript": "javascript", "Java": "java",
                "C++": "cpp", "TypeScript": "typescript", "Go": "go", "Rust": "rust"}
    filename = lang_map.get(language, language.lower())
    docs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", filename + ".md")
    try:
        with open(docs_path, "r") as f:
            return f.read()[:1500]
    except FileNotFoundError:
        return None


def generate_hint(task):
    if not client:
        import random
        mocks = [
            f"Try breaking '{task['title']}' into smaller steps. What is the very first thing that needs to happen?",
            f"Think about what data structure would best represent the problem in '{task['title']}'.",
            f"For '{task['title']}' in {task['language']}: look up the built-in functions available — there may already be something that handles part of this.",
        ]
        return random.choice(mocks)

    lang_docs = load_language_docs(task["language"])
    docs_context = f"\n\nDocumentation links for {task['language']}:\n{lang_docs}" if lang_docs else ""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": (
                    "You are a programming tutor giving a beginner a Socratic hint — "
                    "NOT a solution. Point the student in the right direction without solving it. "
                    "Keep it under 3 sentences. End with a guiding question. "
                    "If relevant, mention a specific official documentation link. Add: 'Verify with docs.'"
                )},
                {"role": "user", "content": (
                    f"Task: {task['title']}\nDescription: {task['description']}\nLanguage: {task['language']}"
                    f"{docs_context}\n\nGive me a hint without giving away the answer."
                )}
            ],
            max_tokens=200,
            temperature=0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Hint unavailable right now. Try breaking the problem into smaller pieces — what is the first step? (Error: {str(e)[:60]})"


# ── STARTUP & RUN ──────────────────────────────────────────────────────────────

with app.app_context():
    init_db()

if __name__ == "__main__":
    print("✓ Database initialised")
    print(f"✓ Hint limit: {HINTS_PER_WEEK} per week")
    print(f"✓ AI: {'connected (Groq)' if client else 'MOCK MODE'}")
    app.run(port=5001, debug=True)
