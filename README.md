# Code Learning Assistant — MVP Prototype

**CSE-2502M | Assignment 4 | Arman Salken**

MVP prototype testing the core hypothesis:
> "If we build a task manager with an AI hint sidebar, beginner programmers will complete at least one coding task per session without leaving the app."

---

## Features

- ✅ Create coding tasks (title, description, language)
- ✅ AI-powered hints via OpenAI GPT-3.5 (Socratic — not full solutions)
- ✅ **3 hints per week limit** (ethical design decision — prevents learned helplessness)
- ✅ Mark tasks as complete / active
- ✅ Hint history per task
- ✅ Works in mock mode without an API key

---

## Prerequisites

- Python 3.10+
- Node.js 18+

---

## Setup & Run

### 1. Clone / open the project

```bash
cd prototype
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Add your OpenAI API key to .env (optional — works without it in mock mode)

pip install flask flask-cors openai
python app.py
```

Backend runs on **http://localhost:5000**

### 3. Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

### 4. Open in browser

Go to **http://localhost:5173**

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Optional | If absent, app runs in mock mode with pre-written hints |

---

## Project Structure

```
prototype/
├── backend/
│   ├── app.py          # Flask API + SQLite + OpenAI adapter
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx                      # Root, routing, state
        └── components/
            ├── TaskList.jsx             # Screen 1: task list + create form
            └── TaskDetail.jsx           # Screen 2: task detail + hint sidebar
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update (complete/uncomplete) |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/:id/hints` | Get hints for task |
| POST | `/api/tasks/:id/hints` | Request new hint (rate-limited) |
| GET | `/api/hints/status` | Weekly hint usage status |

---

## Ethical Design Decisions (Part 2 of Report)

1. **3 hints/week limit** — prevents learned helplessness; forces students to attempt problems independently
2. **Socratic hints only** — system prompt instructs AI to guide, not solve
3. **"Verify with docs" disclaimer** on every hint — acknowledges AI can be wrong (IEEE EAD Competence)
4. **No tracking beyond what's needed** — only stores task text, completion status, hint text
