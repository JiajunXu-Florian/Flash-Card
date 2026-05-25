# Flashcard App

A single-page web application for active-recall learning. Users register, build their own flashcards, flip them to reveal answers, and review their learning history. Administrators can audit every user's activity from a single dashboard.

## Problem Statement

Self-directed learners need a lightweight way to capture knowledge as question/answer cards, practise actively by revealing answers only after attempting recall, and track what they have studied. Admins overseeing a cohort need visibility into every user's learning activity. This app delivers all of that through a single page backed by FastAPI and MySQL, with JWT authentication and role-based access control.

## Tech Stack

| Layer    | Technology                            |
|----------|---------------------------------------|
| Frontend | HTML5, CSS3, JavaScript (SPA)         |
| Backend  | Python 3, FastAPI, Uvicorn            |
| Database | MySQL 8                               |
| Auth     | JWT (PyJWT) + bcrypt password hashing |
| Config   | python-dotenv (`.env` for secrets)    |

## How to Run

### 1. Import the database

```powershell
Get-Content flashcards_export.sql | mysql -u root -p
```

### 2. Configure environment

```powershell
cd flashcard-server
copy .env.example .env
```

Open `.env` and fill in:
- `DB_PASSWORD` — your MySQL root password
- `JWT_SECRET` — any long random string, e.g. `py -c "import secrets; print(secrets.token_urlsafe(48))"`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — initial admin credentials

### 3. Install dependencies

```powershell
py -m pip install -r requirements.txt
```

### 4. Start the server

```powershell
py -m uvicorn server:app --reload --port 3000
```

On first start the server creates an admin account using the credentials from `.env`.

### 5. Open the app

Visit <http://localhost:3000>. Log in as the admin, or click *Create an account* to register as a regular user.

## Folder Structure

```
final flashcard/
├── flashCard.html               The single HTML page hosting all views
├── flashCard.css                Styles for auth, cards, and history views
├── flashCard.js                 SPA logic: auth, view routing, CRUD, history
├── flashcards_export.sql        Database schema (users, cards, view_history)
├── flashcard-server/
│   ├── server.py                FastAPI app: auth, cards, and history routes
│   ├── requirements.txt         Python dependencies
│   ├── .env.example             Template for environment variables
│   └── .env                     Real secrets (git-ignored)
├── .gitignore
└── README.md
```
