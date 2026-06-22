# backend/services/scheduler.py
# Daily alert cron job — replaces the cron in routes/alerts.js

from datetime import datetime
from config.database import supabase
from services.email_service import send_renewal_alert


async def daily_alert_check():
    """Runs daily at 9 AM — checks and sends renewal alerts"""
    print("Running daily alert check at 9 AM...")

    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")

        # Find alerts scheduled for today that haven't been sent
        result = supabase.table("alerts") \
            .select("*, users(*), subscriptions(*)") \
            .eq("alert_date", today) \
            .eq("sent", False) \
            .execute()

        alerts = result.data or []

        if not alerts:
            print("No alerts to send today")
            return

        for alert in alerts:
            try:
                await send_renewal_alert(alert)

                supabase.table("alerts").update({
                    "sent": True
                }).eq("id", alert["id"]).execute()

                print(f"Alert sent for {alert['subscriptions']['service_name']}")
            except Exception as err:
                print(f"Failed to send alert: {err}")

        print(f"Processed {len(alerts)} alerts")

    except Exception as err:
        print(f"Cron job error: {err}")
