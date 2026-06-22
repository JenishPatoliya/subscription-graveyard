# backend/routes/subscriptions.py
# Subscriptions CRUD — exact port of routes/subscriptions.js

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from math import floor, ceil

from config.database import supabase
from middleware.auth import get_current_user

router = APIRouter()


class ManualSubscription(BaseModel):
    serviceName: str
    amount: float
    billingDate: Optional[str] = None
    category: Optional[str] = "Other"


class StatusUpdate(BaseModel):
    userMarked: str


# ─── GET ALL SUBSCRIPTIONS ───────────────────────────

@router.get("/")
async def get_subscriptions(user: dict = Depends(get_current_user)):
    try:
        result = supabase.table("subscriptions") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .order("total_spent", desc=True) \
            .execute()

        subscriptions = result.data or []
        today = datetime.utcnow()

        # Enrich each subscription with receipt gap info
        enriched = []
        for sub in subscriptions:
            last_receipt = None
            days_since = None
            if sub.get("last_receipt_date"):
                last_receipt = datetime.fromisoformat(sub["last_receipt_date"])
                days_since = floor((today - last_receipt).total_seconds() / 86400)

            receipt_status = "unknown"
            if days_since is not None:
                if days_since <= 35:
                    receipt_status = "recent"
                elif days_since <= 90:
                    receipt_status = "moderate"
                else:
                    receipt_status = "long_gap"

            days_until_renewal = None
            if sub.get("next_renewal_date"):
                renewal = datetime.fromisoformat(sub["next_renewal_date"])
                days_until_renewal = ceil((renewal - today).total_seconds() / 86400)

            enriched.append({
                **sub,
                "daysSinceLastReceipt": days_since,
                "receiptStatus": receipt_status,
                "daysUntilRenewal": days_until_renewal
            })

        return {"subscriptions": enriched}

    except Exception as err:
        print(f"Get subscriptions error: {err}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscriptions")


# ─── GET SINGLE SUBSCRIPTION ─────────────────────────

@router.get("/{sub_id}")
async def get_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    try:
        sub_result = supabase.table("subscriptions") \
            .select("*") \
            .eq("id", sub_id) \
            .eq("user_id", user["userId"]) \
            .execute()

        if not sub_result.data or len(sub_result.data) == 0:
            raise HTTPException(status_code=404, detail="Subscription not found")

        receipts_result = supabase.table("receipts") \
            .select("*") \
            .eq("subscription_id", sub_id) \
            .order("receipt_date", desc=True) \
            .limit(24) \
            .execute()

        return {
            "subscription": sub_result.data[0],
            "receipts": receipts_result.data or []
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch subscription")


# ─── ADD MANUAL SUBSCRIPTION ─────────────────────────

@router.post("/manual")
async def add_manual(body: ManualSubscription, user: dict = Depends(get_current_user)):
    try:
        if not body.serviceName or not body.amount:
            raise HTTPException(status_code=400, detail="Service name and amount are required")

        result = supabase.table("subscriptions").insert({
            "user_id": user["userId"],
            "service_name": body.serviceName,
            "amount": float(body.amount),
            "currency": "INR",
            "category": body.category or "Other",
            "next_renewal_date": body.billingDate,
            "total_receipts": 0,
            "total_spent": 0,
            "source_gmail": "manual"
        }).select().execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to add subscription")

        return {"subscription": result.data[0]}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to add subscription")


# ─── UPDATE SUBSCRIPTION STATUS ──────────────────────

@router.patch("/{sub_id}")
async def update_status(sub_id: str, body: StatusUpdate, user: dict = Depends(get_current_user)):
    try:
        valid_statuses = ["active", "cancelled", "reviewing"]
        if body.userMarked not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")

        supabase.table("subscriptions").update({
            "user_marked": body.userMarked,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", sub_id).eq("user_id", user["userId"]).execute()

        return {"message": "Updated successfully"}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update")


# ─── DELETE SUBSCRIPTION ─────────────────────────────

@router.delete("/{sub_id}")
async def delete_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    try:
        supabase.table("alerts").delete().eq("subscription_id", sub_id).execute()
        supabase.table("receipts").delete().eq("subscription_id", sub_id).execute()
        supabase.table("subscriptions").delete() \
            .eq("id", sub_id) \
            .eq("user_id", user["userId"]).execute()

        return {"message": "Deleted successfully"}

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete")
