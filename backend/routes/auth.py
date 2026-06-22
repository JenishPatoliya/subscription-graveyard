# backend/routes/auth.py
# Auth routes — exact port of routes/auth.js

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel
import bcrypt
from jose import jwt
from datetime import datetime, timedelta, timezone

from config.database import supabase
from config.settings import get_settings
from middleware.auth import get_current_user

router = APIRouter()
settings = get_settings()


# ─── REQUEST MODELS ───────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ─── HELPER FUNCTIONS ────────────────────────────────

def safe_user_fields(user: dict) -> dict:
    """
    Safely extract user fields, handling missing columns gracefully.
    The 'plan' and 'is_demo' columns may not exist in older databases.
    """
    return {
        "id": user["id"],
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "plan": user.get("plan", "free"),
        "isDemo": user.get("is_demo", False),
    }


def generate_token(user: dict) -> str:
    """Creates JWT token with user info — mirrors generateToken() in auth.js"""
    payload = {
        "userId": user["id"],
        "email": user["email"],
        "plan": user.get("plan", "free"),
        "isDemo": user.get("is_demo", False),
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRY_DAYS)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def set_cookie(response: Response, token: str):
    """Sets JWT as httpOnly cookie — mirrors setCookie() in auth.js"""
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=False,  # Set True in production
        samesite="lax",
        max_age=7 * 24 * 60 * 60  # 7 days in seconds
    )


# ─── SIGNUP ROUTE ─────────────────────────────────────

@router.post("/signup")
async def signup(body: SignupRequest, response: Response):
    # Validate inputs
    if not body.name or not body.email or not body.password:
        raise HTTPException(status_code=400, detail="All fields are required")

    if "@" not in body.email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    email = body.email.lower().strip()
    name = body.name.strip()

    # Check if email already exists
    try:
        result = supabase.table("users").select("id").eq("email", email).execute()
        if result.data and len(result.data) > 0:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Database query failed during signup check: {e}")
        raise HTTPException(status_code=500, detail="Database error. Please check server logs.")

    # Hash password (12 rounds)
    hashed_password = bcrypt.hashpw(body.password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')

    # Create user in database
    try:
        result = supabase.table("users").insert({
            "name": name,
            "email": email,
            "password": hashed_password
        }).execute()
    except Exception as e:
        error_str = str(e)
        if "42501" in error_str:
            print(f"[ERROR] RLS policy violation on signup — SUPABASE_SERVICE_KEY is likely the anon key!")
            raise HTTPException(
                status_code=500,
                detail="Database permission error. The server is misconfigured (wrong Supabase key). Please contact the admin."
            )
        print(f"[ERROR] Failed to insert user: {e}")
        raise HTTPException(status_code=500, detail="Failed to create account. Try again.")

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=500, detail="Failed to create account. Try again.")

    user = result.data[0]

    # Create default alert preferences
    try:
        supabase.table("alert_preferences").insert({"user_id": user["id"]}).execute()
    except Exception as e:
        # Non-critical — don't fail signup if alert prefs fail
        print(f"[WARNING] Failed to create alert preferences: {e}")

    # Generate token and set cookie
    token = generate_token(user)
    set_cookie(response, token)

    return {
        "message": "Account created successfully",
        "user": safe_user_fields(user)
    }


# ─── LOGIN ROUTE ──────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, response: Response):
    if not body.email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    email = body.email.lower().strip()

    # Find user by email — use SELECT * to avoid crashing on missing columns
    try:
        result = supabase.table("users").select("*").eq("email", email).execute()
    except Exception as e:
        print(f"[ERROR] Database query failed during login: {e}")
        raise HTTPException(status_code=500, detail="Database error. Please try again.")

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    user = result.data[0]

    # Compare password with stored hash
    stored_hash = user["password"]
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode('utf-8')
    if not bcrypt.checkpw(body.password.encode('utf-8'), stored_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    # Generate token
    token = generate_token(user)
    set_cookie(response, token)

    # Check if Gmail is already connected
    try:
        gmail_result = supabase.table("gmail_accounts") \
            .select("gmail_address") \
            .eq("user_id", user["id"]) \
            .limit(1) \
            .execute()
        gmail_connected = bool(gmail_result.data and len(gmail_result.data) > 0)
    except Exception:
        gmail_connected = False

    return {
        "message": "Login successful",
        "user": safe_user_fields(user),
        "mode": "demo" if user.get("is_demo") else "real",
        "gmailConnected": gmail_connected
    }


# ─── GET CURRENT USER ────────────────────────────────

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    try:
        # Use SELECT * to avoid crashing if plan/is_demo columns don't exist
        result = supabase.table("users") \
            .select("*") \
            .eq("id", user["userId"]) \
            .execute()
    except Exception as e:
        print(f"[ERROR] Failed to fetch user profile: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")

    db_user = result.data[0]

    # Return safe user object — omit password, handle missing columns
    return {
        "user": {
            "id": db_user["id"],
            "name": db_user.get("name", ""),
            "email": db_user.get("email", ""),
            "plan": db_user.get("plan", "free"),
            "is_demo": db_user.get("is_demo", False),
            "created_at": db_user.get("created_at", None),
        }
    }


# ─── LOGOUT ───────────────────────────────────────────

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("token")
    return {"message": "Logged out successfully"}
