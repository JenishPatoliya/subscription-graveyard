# backend/routes/gmail.py
# Gmail routes — exact port of routes/gmail.js

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse

from config.database import supabase
from config.settings import get_settings
from middleware.auth import get_current_user
from services.gmail_service import get_auth_url, get_tokens_from_code, create_gmail_client
from services.email_scanner import run_email_scan

router = APIRouter()
settings = get_settings()


# ─── GET AUTH URL ────────────────────────────────────

@router.get("/auth-url")
async def gmail_auth_url(user: dict = Depends(get_current_user)):
    try:
        url = get_auth_url(user["userId"])
        return {"url": url}
    except Exception as err:
        raise HTTPException(status_code=500, detail="Failed to generate auth URL")


# ─── OAUTH CALLBACK ──────────────────────────────────

@router.get("/callback")
async def gmail_callback(request: Request, background_tasks: BackgroundTasks):
    code = request.query_params.get("code")
    user_id = request.query_params.get("state")
    error = request.query_params.get("error")

    print("OAuth callback received")
    print(f"User ID from state: {user_id}")
    print(f"Code exists: {bool(code)}")
    print(f"Error: {error}")

    if error:
        print(f"OAuth error: {error}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect-gmail?error=access_denied")

    if not code:
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect-gmail?error=no_code")

    if not user_id:
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect-gmail?error=no_user")

    try:
        # Exchange code for tokens
        print("Exchanging code for tokens...")
        tokens = get_tokens_from_code(code)
        print(f"Tokens received: access={bool(tokens.get('access_token'))}, refresh={bool(tokens.get('refresh_token'))}")

        if not tokens.get("access_token"):
            return RedirectResponse(f"{settings.FRONTEND_URL}/connect-gmail?error=no_token")

        # Get Gmail address
        gmail = create_gmail_client(tokens["access_token"], tokens.get("refresh_token", ""))
        print("Getting Gmail profile...")
        profile = gmail.users().getProfile(userId="me").execute()
        gmail_address = profile["emailAddress"]
        print(f"Gmail address: {gmail_address}")

        # Check if already exists
        existing = supabase.table("gmail_accounts") \
            .select("id, refresh_token") \
            .eq("user_id", user_id) \
            .eq("gmail_address", gmail_address) \
            .execute()

        if existing.data and len(existing.data) > 0:
            print("Updating existing Gmail account")
            supabase.table("gmail_accounts").update({
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token") or existing.data[0].get("refresh_token")
            }).eq("id", existing.data[0]["id"]).execute()
            print("Gmail account updated successfully")
        else:
            print("Creating new Gmail account record")
            result = supabase.table("gmail_accounts").insert({
                "user_id": user_id,
                "gmail_address": gmail_address,
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "is_primary": True,
                "emails_scanned": 0
            }).execute()

            if not result.data:
                return RedirectResponse(f"{settings.FRONTEND_URL}/connect-gmail?error=save_failed")

            print(f"Gmail account saved: {result.data[0]['id']}")

        # Add background scan task (replaces BullMQ)
        print("Starting background email scan...")
        background_tasks.add_task(run_email_scan, user_id, gmail_address)
        print("Scan task added")

        return RedirectResponse(f"{settings.FRONTEND_URL}/scanning")

    except Exception as err:
        print(f"Callback error: {err}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect-gmail?error=failed")


# ─── GET SCAN STATUS ─────────────────────────────────

@router.get("/scan-status")
async def scan_status(user: dict = Depends(get_current_user)):
    try:
        gmail_result = supabase.table("gmail_accounts") \
            .select("gmail_address, last_scanned, emails_scanned, is_primary") \
            .eq("user_id", user["userId"]) \
            .execute()

        sub_result = supabase.table("subscriptions") \
            .select("id", count="exact") \
            .eq("user_id", user["userId"]) \
            .execute()

        gmail_accounts = gmail_result.data or []

        return {
            "gmailAccounts": gmail_accounts,
            "subscriptionsFound": sub_result.count or 0,
            "scanComplete": all(a.get("last_scanned") for a in gmail_accounts) if gmail_accounts else False
        }

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get scan status")


# ─── RESCAN ───────────────────────────────────────────

@router.post("/rescan")
async def rescan(background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    try:
        if user.get("isDemo"):
            return {"message": "Rescan complete"}

        result = supabase.table("gmail_accounts") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .execute()

        gmail_accounts = result.data or []
        if not gmail_accounts:
            raise HTTPException(status_code=400, detail="No Gmail connected")

        for account in gmail_accounts:
            background_tasks.add_task(
                run_email_scan,
                user["userId"],
                account["gmail_address"]
            )

        return {"message": "Rescan started"}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to start rescan")


# ─── DISCONNECT GMAIL ────────────────────────────────

@router.delete("/disconnect/{gmail_address}")
async def disconnect_gmail(gmail_address: str, user: dict = Depends(get_current_user)):
    try:
        print(f"Disconnecting Gmail: {gmail_address} for user: {user['userId']}")

        # Get subscription IDs for this Gmail
        subs_result = supabase.table("subscriptions") \
            .select("id") \
            .eq("user_id", user["userId"]) \
            .eq("source_gmail", gmail_address) \
            .execute()

        subs = subs_result.data or []
        if subs:
            sub_ids = [s["id"] for s in subs]
            print(f"Deleting {len(sub_ids)} subscriptions and related data...")
            try:
                supabase.table("alerts").delete().in_("subscription_id", sub_ids).execute()
            except Exception as e:
                print(f"[WARNING] Alerts delete failed (non-fatal): {e}")
            try:
                supabase.table("receipts").delete().in_("subscription_id", sub_ids).execute()
            except Exception as e:
                print(f"[WARNING] Receipts delete failed (non-fatal): {e}")
            supabase.table("subscriptions").delete() \
                .eq("user_id", user["userId"]) \
                .eq("source_gmail", gmail_address).execute()

        supabase.table("gmail_accounts").delete() \
            .eq("user_id", user["userId"]) \
            .eq("gmail_address", gmail_address).execute()

        print(f"Gmail {gmail_address} disconnected successfully")
        return {"message": "Gmail disconnected successfully"}

    except Exception as e:
        print(f"[ERROR] Disconnect Gmail failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")
