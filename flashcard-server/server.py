from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import mysql.connector
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

db = mysql.connector.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "flashcards"),
    charset="utf8mb4"
)

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "12"))
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

cursor = db.cursor(dictionary=True)
cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
if not cursor.fetchone():
    cursor2 = db.cursor()
    cursor2.execute(
        "INSERT INTO users (id, username, password_hash, role) VALUES (%s, %s, %s, 'admin')",
        (str(uuid.uuid4()),
         ADMIN_USERNAME,
         bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt(12)).decode())
    )
    db.commit()
    print(f"created admin: {ADMIN_USERNAME}")

def get_current_user(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "login required")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "invalid token")
    return {"id": payload["sub"], "name": payload["name"], "role": payload["role"]}

@app.get("/")
@app.get("/flashCard.html")
def serve_html():
    return FileResponse("../flashCard.html")

@app.get("/flashCard.css")
def serve_css():
    return FileResponse("../flashCard.css")

@app.get("/flashCard.js")
def serve_js():
    return FileResponse("../flashCard.js")

@app.get("/cards")
def get_cards(request: Request):
    user = get_current_user(request)
    cursor = db.cursor(dictionary=True)
    if user["role"] == "admin":
        cursor.execute("SELECT * FROM cards")
    else:
        cursor.execute("SELECT * FROM cards WHERE owner_id = %s", (user["id"],))
    rows = cursor.fetchall()
    return rows

@app.post("/cards")
async def create_card(request: Request):
    user = get_current_user(request)
    data = await request.json()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO cards (id, owner_id, category, level, question, answer, review, accent) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (data["id"], user["id"], data["category"], data["level"], data["question"], data["answer"], data["review"], data["accent"])
    )
    db.commit()
    data["owner_id"] = user["id"]
    return data

@app.put("/cards/{card_id}")
async def update_card(card_id: str, request: Request):
    user = get_current_user(request)
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT owner_id FROM cards WHERE id = %s", (card_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, "card not found")
    if user["role"] != "admin" and row["owner_id"] != user["id"]:
        raise HTTPException(403, "not your card")
    data = await request.json()
    cursor = db.cursor()
    cursor.execute(
        "UPDATE cards SET category=%s, level=%s, question=%s, answer=%s, review=%s, accent=%s WHERE id=%s",
        (data["category"], data["level"], data["question"], data["answer"], data["review"], data["accent"], card_id)
    )
    db.commit()
    return {"ok": True}

@app.delete("/cards/{card_id}")
def delete_card(card_id: str, request: Request):
    user = get_current_user(request)
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT owner_id FROM cards WHERE id = %s", (card_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, "card not found")
    if user["role"] != "admin" and row["owner_id"] != user["id"]:
        raise HTTPException(403, "not your card")
    cursor = db.cursor()
    cursor.execute("DELETE FROM cards WHERE id=%s", (card_id,))
    db.commit()
    return {"ok": True}

@app.post("/auth/register")
async def register(request: Request):
    data = await request.json()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if len(username) < 3 or len(password) < 6:
        raise HTTPException(400, "username >= 3 chars, password >= 6 chars")
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
    if cursor.fetchone():
        raise HTTPException(409, "username already taken")
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO users (id, username, password_hash, role) VALUES (%s, %s, %s, 'user')",
        (user_id, username, password_hash)
    )
    db.commit()
    payload = {
        "sub": user_id,
        "name": username,
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"token": token, "user": {"id": user_id, "username": username, "role": "user"}}

@app.post("/auth/login")
async def login(request: Request):
    data = await request.json()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "invalid username or password")
    payload = {
        "sub": user["id"],
        "name": user["username"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "role": user["role"]}}

@app.get("/auth/me")
def whoami(request: Request):
    return get_current_user(request)

@app.post("/history")
async def record_history(request: Request):
    user = get_current_user(request)
    data = await request.json()
    card_id = data.get("card_id")
    snapshot = data.get("card_question_snapshot") or ""
    if not card_id:
        raise HTTPException(400, "card_id required")
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO view_history (user_id, card_id, card_question_snapshot) VALUES (%s, %s, %s)",
        (user["id"], card_id, snapshot)
    )
    db.commit()
    return {"id": cursor.lastrowid}

@app.get("/history/me")
def my_history(request: Request):
    user = get_current_user(request)
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, user_id, card_id, card_question_snapshot, viewed_at FROM view_history WHERE user_id = %s ORDER BY viewed_at DESC LIMIT 500",
        (user["id"],)
    )
    return cursor.fetchall()

@app.get("/history/all")
def all_history(request: Request):
    user = get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(403, "admin only")
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT h.id, h.user_id, u.username, h.card_id, h.card_question_snapshot, h.viewed_at FROM view_history h JOIN users u ON u.id = h.user_id ORDER BY h.viewed_at DESC LIMIT 1000"
    )
    return cursor.fetchall()

@app.delete("/history/{history_id}")
def delete_history(history_id: int, request: Request):
    user = get_current_user(request)
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT user_id FROM view_history WHERE id = %s", (history_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, "history not found")
    if user["role"] != "admin" and row["user_id"] != user["id"]:
        raise HTTPException(403, "not your history")
    cursor = db.cursor()
    cursor.execute("DELETE FROM view_history WHERE id = %s", (history_id,))
    db.commit()
    return {"ok": True}
