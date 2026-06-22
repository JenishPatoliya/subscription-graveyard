# backend/services/email_scanner.py
# Background email scanning — replaces workers/emailWorker.js
# Uses asyncio instead of BullMQ

import asyncio
from datetime import datetime
from config.database import supabase
from services.gmail_service import create_gmail_client, search_receipt_emails, get_email_content
from services.ai_service import parse_email_for_subscription

def print(*args, **kwargs):
    import builtins
    try:
        builtins.print(*args, **kwargs)
    except UnicodeEncodeError:
        clean_args = [
            str(arg).encode('ascii', errors='replace').decode('ascii')
            for arg in args
        ]
        builtins.print(*clean_args, **kwargs)


async def run_email_scan(user_id: str, gmail_address: str):
    """
    Background email scan task — exact port of emailWorker.js processJob().
    Called via FastAPI BackgroundTasks instead of BullMQ.
    """
    print("=== SCAN STARTED ===")
    print(f"Gmail: {gmail_address}")

    # Get Gmail account from database
    result = supabase.table("gmail_accounts") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("gmail_address", gmail_address) \
        .execute()

    if not result.data or len(result.data) == 0:
        print("Gmail account not found in database")
        return

    gmail_account = result.data[0]
    emails_scanned = 0
    subscriptions_found = 0

    try:
        # ─── CLEAN SLATE: Delete existing subscriptions for this Gmail ───
        print(f"Clearing old subscription data for {gmail_address}...")

        existing_result = supabase.table("subscriptions") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("source_gmail", gmail_address) \
            .execute()

        existing_subs = existing_result.data or []

        if existing_subs:
            sub_ids = [s["id"] for s in existing_subs]

            supabase.table("alerts").delete().in_("subscription_id", sub_ids).execute()
            supabase.table("receipts").delete().in_("subscription_id", sub_ids).execute()
            supabase.table("subscriptions").delete() \
                .eq("user_id", user_id) \
                .eq("source_gmail", gmail_address).execute()

            print(f"Cleared {len(existing_subs)} old subscriptions for {gmail_address}")

        # Create Gmail client
        gmail = create_gmail_client(
            gmail_account["access_token"],
            gmail_account["refresh_token"]
        )

        # Search for receipt emails
        messages = search_receipt_emails(gmail)
        print(f"Processing {len(messages)} emails")

        for i, message in enumerate(messages):
            try:
                print(f"Email {i + 1} of {len(messages)}")

                # Get email content
                email_data = get_email_content(gmail, message["id"])
                print(f"Subject: {email_data['subject']}")

                # Parse with AI / pattern matching
                result = await parse_email_for_subscription(email_data)
                print(f"Result: {result.get('isSubscription')} {result.get('serviceName')} {result.get('amount')}")

                # Only save if valid subscription detected
                if result.get("isSubscription") is True and result.get("serviceName"):
                    save_amount = result.get("amount") or 0

                    # Check if subscription already exists
                    existing = supabase.table("subscriptions") \
                        .select("*") \
                        .eq("user_id", user_id) \
                        .ilike("service_name", f"%{result['serviceName']}%") \
                        .execute()

                    if existing.data and len(existing.data) > 0:
                        # Update existing
                        ex = existing.data[0]
                        supabase.table("subscriptions").update({
                            "total_spent": float(ex["total_spent"]) + save_amount,
                            "total_receipts": ex["total_receipts"] + 1,
                            "last_receipt_date": result.get("receiptDate") or ex.get("last_receipt_date"),
                            "next_renewal_date": result.get("renewalDate") or ex.get("next_renewal_date"),
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("id", ex["id"]).execute()

                        # Save receipt if not duplicate
                        dup_check = supabase.table("receipts") \
                            .select("id") \
                            .eq("gmail_message_id", message["id"]) \
                            .execute()

                        if not dup_check.data or len(dup_check.data) == 0:
                            supabase.table("receipts").insert({
                                "user_id": user_id,
                                "subscription_id": ex["id"],
                                "gmail_message_id": message["id"],
                                "amount": save_amount,
                                "receipt_date": result.get("receiptDate"),
                                "raw_subject": email_data["subject"]
                            }).execute()

                        print(f"Updated: {ex['service_name']}")

                    else:
                        # Create new subscription
                        new_sub_result = supabase.table("subscriptions").insert({
                            "user_id": user_id,
                            "source_gmail": gmail_address,
                            "service_name": result["serviceName"],
                            "amount": save_amount,
                            "currency": result.get("currency", "INR"),
                            "category": result.get("category", "Other"),
                            "first_receipt_date": result.get("receiptDate"),
                            "last_receipt_date": result.get("receiptDate"),
                            "next_renewal_date": result.get("renewalDate"),
                            "total_receipts": 1,
                            "total_spent": save_amount,
                            "cancel_url": result.get("cancelUrl")
                        }).execute()

                        if new_sub_result.data and len(new_sub_result.data) > 0:
                            new_sub = new_sub_result.data[0]

                            # Save receipt
                            supabase.table("receipts").insert({
                                "user_id": user_id,
                                "subscription_id": new_sub["id"],
                                "gmail_message_id": message["id"],
                                "amount": save_amount,
                                "receipt_date": result.get("receiptDate"),
                                "raw_subject": email_data["subject"]
                            }).execute()

                            # Schedule alert
                            if result.get("renewalDate"):
                                from datetime import timedelta
                                alert_date = datetime.fromisoformat(result["renewalDate"])
                                alert_date = alert_date - timedelta(days=3)
                                supabase.table("alerts").insert({
                                    "user_id": user_id,
                                    "subscription_id": new_sub["id"],
                                    "alert_date": alert_date.strftime("%Y-%m-%d"),
                                    "days_before": 3
                                }).execute()

                            subscriptions_found += 1
                            print(f"SAVED: {result['serviceName']} ₹{save_amount}")

                emails_scanned += 1

            except Exception as err:
                print(f"Email error, skipping: {err}")
                emails_scanned += 1

            # Update progress
            supabase.table("gmail_accounts").update({
                "emails_scanned": emails_scanned
            }).eq("id", gmail_account["id"]).execute()

            await asyncio.sleep(0.4)

    except Exception as err:
        print(f"Scan error: {err}")

    finally:
        supabase.table("gmail_accounts").update({
            "last_scanned": datetime.utcnow().isoformat(),
            "emails_scanned": emails_scanned
        }).eq("id", gmail_account["id"]).execute()

        print("=== SCAN COMPLETE ===")
        print(f"Emails processed: {emails_scanned}")
        print(f"New subscriptions: {subscriptions_found}")
