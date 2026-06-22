# backend/routes/alerts.py
# Alerts routes — port of routes/alerts.js

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from math import ceil

from config.database import supabase
from middleware.auth import get_current_user

router = APIRouter()


@router.get("/")
async def get_alerts(user: dict = Depends(get_current_user)):
    try:
        today = datetime.utcnow()
        thirty_days = today + timedelta(days=30)

        today_str = today.strftime("%Y-%m-%d")
        thirty_str = thirty_days.strftime("%Y-%m-%d")

        # Get subscriptions renewing in next 30 days
        upcoming_result = supabase.table("subscriptions") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .gte("next_renewal_date", today_str) \
            .lte("next_renewal_date", thirty_str) \
            .order("next_renewal_date") \
            .execute()

        # Get recent receipts
        recent_result = supabase.table("receipts") \
            .select("*, subscriptions(service_name, amount, category)") \
            .eq("user_id", user["userId"]) \
            .order("receipt_date", desc=True) \
            .limit(5) \
            .execute()

        # Add days until renewal
        enriched = []
        for sub in (upcoming_result.data or []):
            renewal = datetime.fromisoformat(sub["next_renewal_date"])
            days_until = ceil((renewal - today).total_seconds() / 86400)
            enriched.append({**sub, "daysUntil": days_until})

        return {
            "upcoming": enriched,
            "recent": recent_result.data or []
        }

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch alerts")
