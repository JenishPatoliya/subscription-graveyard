# backend/routes/report.py
# Spending report — port of routes/report.js

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from math import floor

from config.database import supabase
from middleware.auth import get_current_user

router = APIRouter()


@router.get("/")
async def get_report(user: dict = Depends(get_current_user)):
    try:
        result = supabase.table("subscriptions") \
            .select("*") \
            .eq("user_id", user["userId"]) \
            .execute()

        subscriptions = result.data or []

        if not subscriptions:
            return {
                "totalMonthly": 0,
                "totalYearly": 0,
                "byCategory": [],
                "topSubscriptions": [],
                "potentialSavings": 0,
                "noRecentReceipt": [],
                "monthlyTrend": []
            }

        # Total monthly spend
        total_monthly = sum(float(s.get("amount", 0)) for s in subscriptions)

        # Group by category
        category_map = {}
        for sub in subscriptions:
            cat = sub.get("category", "Other")
            category_map[cat] = category_map.get(cat, 0) + float(sub.get("amount", 0))

        by_category = sorted([
            {
                "name": name,
                "amount": amount,
                "percentage": round((amount / total_monthly) * 100) if total_monthly > 0 else 0
            }
            for name, amount in category_map.items()
        ], key=lambda x: x["amount"], reverse=True)

        # Top subscriptions
        sorted_subs = sorted(subscriptions, key=lambda s: float(s.get("amount", 0)), reverse=True)
        top_subscriptions = [
            {
                "id": s["id"],
                "name": s["service_name"],
                "monthly": s["amount"],
                "yearly": float(s["amount"]) * 12,
                "category": s.get("category"),
                "lastReceipt": s.get("last_receipt_date")
            }
            for s in sorted_subs[:6]
        ]

        # No recent receipt (90+ days)
        today = datetime.utcnow()
        no_recent = []
        for sub in subscriptions:
            if sub.get("last_receipt_date"):
                last = datetime.fromisoformat(sub["last_receipt_date"])
                days = floor((today - last).total_seconds() / 86400)
                if days > 90:
                    no_recent.append(sub)

        potential_savings = sum(float(s.get("amount", 0)) for s in no_recent)

        # Monthly trend from receipts
        six_months_ago = today - timedelta(days=180)
        receipts_result = supabase.table("receipts") \
            .select("amount, receipt_date") \
            .eq("user_id", user["userId"]) \
            .gte("receipt_date", six_months_ago.strftime("%Y-%m-%d")) \
            .execute()

        monthly_map = {}
        for r in (receipts_result.data or []):
            if r.get("receipt_date"):
                month = r["receipt_date"][:7]  # YYYY-MM
                monthly_map[month] = monthly_map.get(month, 0) + float(r.get("amount", 0))

        monthly_trend = sorted([
            {"month": month, "amount": amount}
            for month, amount in monthly_map.items()
        ], key=lambda x: x["month"])

        return {
            "totalMonthly": total_monthly,
            "totalYearly": total_monthly * 12,
            "byCategory": by_category,
            "topSubscriptions": top_subscriptions,
            "potentialSavings": potential_savings,
            "noRecentReceipt": [
                {"id": s["id"], "name": s["service_name"], "amount": s["amount"], "lastReceipt": s.get("last_receipt_date")}
                for s in no_recent
            ],
            "monthlyTrend": monthly_trend
        }

    except Exception as err:
        print(f"Report error: {err}")
        raise HTTPException(status_code=500, detail="Failed to generate report")
