# backend/services/email_service.py
# Email notification service — port of services/emailService.js

import resend
from datetime import datetime
from config.settings import get_settings

settings = get_settings()

if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY


async def send_renewal_alert(alert: dict):
    """Send renewal alert email — mirrors sendRenewalAlert()"""
    user = alert.get("users", {})
    sub = alert.get("subscriptions", {})

    renewal_date = datetime.fromisoformat(sub["next_renewal_date"])
    days_until = (renewal_date - datetime.utcnow()).days

    resend.Emails.send({
        "from": "alerts@subscriptiongraveyard.com",
        "to": user["email"],
        "subject": f"⏰ {sub['service_name']} charges ₹{sub['amount']} in {days_until} days",
        "html": f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 32px; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="background: #FF4455; color: white; padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
                    <p style="margin:0; font-size:12px; letter-spacing:2px; opacity:0.8;">RENEWAL ALERT</p>
                    <h2 style="margin: 8px 0; font-size: 24px;">{sub['service_name']}</h2>
                    <p style="margin: 0; font-size: 36px; font-weight: 900;">₹{sub['amount']}</p>
                </div>
                <p style="color: #333; font-size: 15px; line-height: 1.7;">Hi {user.get('name', 'there')},</p>
                <p style="color: #333; font-size: 15px; line-height: 1.7;">
                    <strong>{sub['service_name']}</strong> will automatically charge you
                    <strong>₹{sub['amount']}</strong> on <strong>{sub['next_renewal_date']}</strong>.
                </p>
                <p style="color: #666; font-size: 13px;">
                    Last receipt we found in Gmail: {sub.get('last_receipt_date', 'Not found')}
                </p>
                <a href="{sub.get('cancel_url', '#')}" style="display: block; background: #FF4455; color: white; text-decoration: none; padding: 14px; border-radius: 10px; text-align: center; font-weight: 700; font-size: 15px; margin-bottom: 10px;">
                    Cancel {sub['service_name']} →
                </a>
                <a href="{settings.FRONTEND_URL}/dashboard" style="display: block; background: #f5f5f5; color: #333; text-decoration: none; padding: 14px; border-radius: 10px; text-align: center; font-size: 14px;">
                    View My Dashboard
                </a>
                <p style="color: #999; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.6;">
                    Subscription Graveyard — Know exactly what you pay for.<br>
                    We never cancel subscriptions on your behalf.
                </p>
            </div>
        </body>
        </html>
        """
    })
