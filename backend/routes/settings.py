# backend/routes/settings.py
# Settings routes — port of routes/settings.js

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from config.database import supabase
from middleware.auth import get_current_user

router = APIRouter()


class PreferencesUpdate(BaseModel):
    emailAlerts: Optional[bool] = True
    daysBefore: Optional[int] = 3
    weeklyDigest: Optional[bool] = True


@router.get("/")
async def get_settings(user: dict = Depends(get_current_user)):
    try:
        # Use SELECT * to avoid crash if 'plan' column doesn't exist yet
        user_result = supabase.table("users") \
            .select("*") \
            .eq("id", user["userId"]) \
            .execute()

        gmail_result = supabase.table("gmail_accounts") \
            .select("gmail_address, is_primary, last_scanned, emails_scanned") \
            .eq("user_id", user["userId"]) \
            .execute()

        prefs_result = supabase.table("alert_preferences") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .execute()

        prefs = prefs_result.data[0] if prefs_result.data else {
            "email_alerts": True,
            "days_before": 3,
            "weekly_digest": True
        }

        return {
            "user": user_result.data[0] if user_result.data else None,
            "gmailAccounts": gmail_result.data or [],
            "preferences": prefs
        }

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch settings")


@router.patch("/preferences")
async def update_preferences(body: PreferencesUpdate, user: dict = Depends(get_current_user)):
    try:
        supabase.table("alert_preferences").upsert({
            "user_id": user["userId"],
            "email_alerts": body.emailAlerts,
            "days_before": body.daysBefore,
            "weekly_digest": body.weeklyDigest
        }).execute()

        return {"message": "Preferences saved"}

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save preferences")


@router.delete("/data")
async def delete_all_data(user: dict = Depends(get_current_user)):
    try:
        user_id = user["userId"]
        supabase.table("alerts").delete().eq("user_id", user_id).execute()
        supabase.table("receipts").delete().eq("user_id", user_id).execute()
        supabase.table("subscriptions").delete().eq("user_id", user_id).execute()
        supabase.table("gmail_accounts").delete().eq("user_id", user_id).execute()
        supabase.table("alert_preferences").delete().eq("user_id", user_id).execute()

        return {"message": "All your data has been deleted"}

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete data")
