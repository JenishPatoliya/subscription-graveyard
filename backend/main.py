# backend/main.py
# FastAPI Application — main entrypoint

import os
import base64
import json
from dotenv import load_dotenv

# Load .env BEFORE any other imports that use settings
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config.settings import get_settings

settings = get_settings()


# ─── STARTUP UTILITIES ───────────────────────────────

def validate_supabase_key():
    """
    Check if SUPABASE_SERVICE_KEY is actually a service_role key.
    The anon key will cause RLS policy violations on all writes.
    """
    key = settings.SUPABASE_SERVICE_KEY
    try:
        # JWT has 3 parts: header.payload.signature
        payload_b64 = key.split(".")[1]
        # Add padding if needed
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        role = payload.get("role", "unknown")

        if role == "anon":
            print("   +----------------------------------------------------------+")
            print("   |  WARNING: SUPABASE_SERVICE_KEY is the ANON key!          |")
            print("   |  This will cause RLS policy errors on signup/login.      |")
            print("   |                                                          |")
            print("   |  Fix: Go to Supabase Dashboard -> Settings -> API        |")
            print("   |  Copy the 'service_role' key (NOT the anon key)          |")
            print("   |  Update SUPABASE_SERVICE_KEY in backend/.env             |")
            print("   +----------------------------------------------------------+")
            return False
        elif role == "service_role":
            print("   [OK] Supabase service_role key verified")
            return True
        else:
            print(f"   [WARNING] Supabase key role is '{role}' - expected 'service_role'")
            return False
    except Exception as e:
        print(f"   [WARNING] Could not validate Supabase key: {e}")
        return False


def ensure_db_columns():
    """
    Ensure the users table has 'plan' and 'is_demo' columns.
    These are referenced by the code but may be missing from the live database.
    """
    from config.database import supabase

    try:
        # Try to read a user with plan and is_demo columns
        # If columns don't exist, this will throw a 42703 error
        result = supabase.table("users").select("id, plan, is_demo").limit(1).execute()
        print("   [OK] Database columns (plan, is_demo) verified")
        return True
    except Exception as e:
        error_str = str(e)
        if "42703" in error_str:
            print("   [WARNING] Missing columns 'plan' and/or 'is_demo' in users table")
            print("   [INFO] Attempting to add missing columns via RPC...")

            # Try adding columns using Supabase's REST API by running raw SQL
            try:
                # Use supabase rpc to run raw SQL
                supabase.rpc("exec_sql", {
                    "query": "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'; ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;"
                }).execute()
                print("   [OK] Missing columns added successfully")
                return True
            except Exception:
                print("   [WARNING] Could not auto-add columns. Please run this SQL in Supabase SQL Editor:")
                print("            ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';")
                print("            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;")
                return False
        else:
            print(f"   [WARNING] Database check failed: {e}")
            return False


def seed_demo_user():
    """
    Create the demo user if it doesn't already exist.
    The demo account lets users try the app without signing up.
    """
    import bcrypt
    from config.database import supabase

    demo_email = settings.DEMO_EMAIL
    demo_password = settings.DEMO_PASSWORD

    try:
        # Check if demo user already exists
        result = supabase.table("users").select("id").eq("email", demo_email).execute()
        if result.data and len(result.data) > 0:
            print(f"   [OK] Demo user ({demo_email}) exists")
            return

        # Create demo user with hashed password
        hashed_password = bcrypt.hashpw(
            demo_password.encode('utf-8'),
            bcrypt.gensalt(12)
        ).decode('utf-8')

        insert_data = {
            "name": "Demo User",
            "email": demo_email,
            "password": hashed_password,
        }

        result = supabase.table("users").insert(insert_data).execute()

        if result.data and len(result.data) > 0:
            demo_user = result.data[0]
            print(f"   [OK] Demo user created ({demo_email})")

            # Create default alert preferences for demo user
            try:
                supabase.table("alert_preferences").insert({
                    "user_id": demo_user["id"]
                }).execute()
            except Exception:
                pass  # Alert preferences are optional
        else:
            print(f"   [WARNING] Failed to create demo user")

    except Exception as e:
        error_str = str(e)
        if "42501" in error_str:
            print(f"   [SKIP] Cannot seed demo user - RLS policy blocking writes (fix Supabase key first)")
        elif "42703" in error_str:
            # Missing columns - try without plan/is_demo
            print(f"   [WARNING] Cannot seed demo user - missing database columns")
        else:
            print(f"   [WARNING] Demo user seeding failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("[INFO] Subscription Graveyard API starting...")
    print(f"   Frontend: {settings.FRONTEND_URL}")
    print(f"   Port: {settings.PORT}")

    # ─── Validate Supabase key ───
    validate_supabase_key()

    # ─── Check database columns ───
    ensure_db_columns()

    # ─── Seed demo user ───
    seed_demo_user()

    # Start daily alert scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from services.scheduler import daily_alert_check

        scheduler = AsyncIOScheduler()
        scheduler.add_job(daily_alert_check, 'cron', hour=9, minute=0)
        scheduler.start()
        print("   [INFO] Daily alert scheduler started (9:00 AM)")
    except Exception as e:
        print(f"   [WARNING] Scheduler failed to start: {e}")

    print("   [INFO] Server ready!")
    yield
    # Shutdown
    print("[INFO] Server shutting down...")


app = FastAPI(
    title="Subscription Graveyard API",
    description="AI-powered subscription management with 5 ML models",
    version="2.0.0",
    lifespan=lifespan
)

# ─── CORS Middleware ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Register Routes ───
from routes import auth, gmail, subscriptions, alerts, report, settings as settings_routes, insights

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(gmail.router, prefix="/api/gmail", tags=["Gmail"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(report.router, prefix="/api/report", tags=["Report"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["Settings"])
app.include_router(insights.router, prefix="/api/insights", tags=["ML Insights"])


# ─── Health Check ───
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Subscription Graveyard API",
        "version": "2.0.0",
        "mlModels": [
            "IsolationForest (anomaly detection)",
            "XGBoost (spending prediction)",
            "KMeans (subscription clustering)",
            "TF-IDF + RandomForest (email classification)",
            "Groq LLM (AI insights)"
        ]
    }


# ─── Root ───
@app.get("/")
async def root():
    return {"message": "Subscription Graveyard API v2.0 — Python/FastAPI"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
