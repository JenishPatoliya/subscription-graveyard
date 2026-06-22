# backend/services/gmail_service.py
# Gmail API service — exact port of services/gmailService.js

import re
import base64
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from config.settings import get_settings

settings = get_settings()


# ─── CREATE GMAIL CLIENT ─────────────────────────────

def create_gmail_client(access_token: str, refresh_token: str):
    """Creates an authenticated Gmail API client — mirrors createGmailClient()"""
    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    return build("gmail", "v1", credentials=credentials)


# ─── GENERATE AUTH URL ────────────────────────────────

def get_auth_url(user_id: str) -> str:
    """Creates the Google OAuth login URL — mirrors getAuthUrl()"""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"{settings.BACKEND_URL}/api/gmail/callback"]
            }
        },
        scopes=["https://www.googleapis.com/auth/gmail.readonly"]
    )
    flow.redirect_uri = f"{settings.BACKEND_URL}/api/gmail/callback"

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=user_id,
        include_granted_scopes="true"
    )
    return auth_url


# ─── GET TOKENS FROM CODE ────────────────────────────

def get_tokens_from_code(code: str) -> dict:
    """Exchanges authorization code for tokens — mirrors getTokensFromCode()"""
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"{settings.BACKEND_URL}/api/gmail/callback"]
            }
        },
        scopes=["https://www.googleapis.com/auth/gmail.readonly"]
    )
    flow.redirect_uri = f"{settings.BACKEND_URL}/api/gmail/callback"
    flow.fetch_token(code=code)

    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token
    }


# ─── SEARCH RECEIPT EMAILS ───────────────────────────

def search_receipt_emails(gmail) -> list:
    """Searches Gmail for receipt/billing emails — mirrors searchReceiptEmails()"""
    print("Searching Gmail with multiple queries...")

    # Query 1: Payment/billing keywords
    payment_query = (
        '(receipt OR invoice OR payment OR subscription OR renewal OR billing '
        'OR charged OR membership OR "payment method" OR "next billing" '
        'OR "successfully processed" OR "amount paid" OR "plan renewed") newer_than:1y'
    )

    # Query 2: Known service names in subject
    service_query = (
        'subject:(netflix OR spotify OR chatgpt OR canva OR "youtube premium" '
        'OR "amazon prime" OR hotstar OR adobe OR notion OR github OR linkedin '
        'OR zoom OR "google one" OR icloud OR nordvpn) newer_than:1y'
    )

    payment_res = gmail.users().messages().list(
        userId="me", q=payment_query, maxResults=200
    ).execute()

    service_res = gmail.users().messages().list(
        userId="me", q=service_query, maxResults=50
    ).execute()

    payment_messages = payment_res.get("messages", [])
    service_messages = service_res.get("messages", [])

    # Deduplicate by message ID
    seen = set()
    all_messages = []
    for msg in payment_messages + service_messages:
        if msg["id"] not in seen:
            seen.add(msg["id"])
            all_messages.append(msg)

    print(f"Found {len(payment_messages)} payment emails + {len(service_messages)} service emails = {len(all_messages)} unique")
    return all_messages


# ─── DECODE BASE64URL ─────────────────────────────────

def decode_base64url(data: str) -> str:
    """Decodes base64url encoded data — mirrors decodeBase64Url()"""
    if not data:
        return ""
    try:
        # Add padding if needed
        padded = data + "=" * (4 - len(data) % 4) if len(data) % 4 else data
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        return ""


# ─── FIND TEXT/HTML PARTS ─────────────────────────────

def find_text_part(part: dict) -> str | None:
    """Recursively finds text/plain part — mirrors findTextPart()"""
    if not part:
        return None
    if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
        return decode_base64url(part["body"]["data"])
    for sub_part in part.get("parts", []):
        found = find_text_part(sub_part)
        if found:
            return found
    return None


def find_html_part(part: dict) -> str | None:
    """Recursively finds text/html part and strips HTML — mirrors findHtmlPart()"""
    if not part:
        return None
    if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
        html = decode_base64url(part["body"]["data"])
        clean = html

        # Remove style tags
        while "<style" in clean and "</style>" in clean:
            start = clean.index("<style")
            end = clean.index("</style>", start)
            if end == -1:
                break
            clean = clean[:start] + clean[end + 8:]

        # Remove script tags
        while "<script" in clean and "</script>" in clean:
            start = clean.index("<script")
            end = clean.index("</script>", start)
            if end == -1:
                break
            clean = clean[:start] + clean[end + 9:]

        # Strip remaining HTML tags
        clean = re.sub(r"<[^>]*>", " ", clean)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean

    for sub_part in part.get("parts", []):
        found = find_html_part(sub_part)
        if found:
            return found
    return None


def get_body_text(payload: dict) -> str:
    """Extracts body text from email payload — mirrors getBodyText()"""
    if not payload:
        return ""

    if payload.get("body", {}).get("data"):
        text = decode_base64url(payload["body"]["data"])
        if payload.get("mimeType") == "text/html":
            clean = text
            while "<style" in clean and "</style>" in clean:
                start = clean.index("<style")
                end = clean.index("</style>", start)
                if end == -1:
                    break
                clean = clean[:start] + clean[end + 8:]
            while "<script" in clean and "</script>" in clean:
                start = clean.index("<script")
                end = clean.index("</script>", start)
                if end == -1:
                    break
                clean = clean[:start] + clean[end + 9:]
            clean = re.sub(r"<[^>]*>", " ", clean)
            clean = re.sub(r"\s+", " ", clean).strip()
            return clean
        return text

    body = find_text_part(payload)
    if not body:
        body = find_html_part(payload)
    return body or ""


# ─── GET EMAIL CONTENT ────────────────────────────────

def get_email_content(gmail, message_id: str) -> dict:
    """Gets full content of a specific email — mirrors getEmailContent()"""
    response = gmail.users().messages().get(
        userId="me", id=message_id, format="full"
    ).execute()

    headers = response.get("payload", {}).get("headers", [])
    subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
    from_addr = next((h["value"] for h in headers if h["name"] == "From"), "")
    date = next((h["value"] for h in headers if h["name"] == "Date"), "")
    snippet = response.get("snippet", "")

    # Extract body using helper
    full_body = get_body_text(response.get("payload", {}))

    # Clean and truncate for AI processing
    clean_body = full_body \
        .replace("&nbsp;", " ") \
        .replace("&amp;", "&")
    clean_body = re.sub(r"\s+", " ", clean_body).strip()[:3000]

    return {
        "subject": subject,
        "from": from_addr,
        "date": date,
        "snippet": snippet,
        "body": clean_body,
        "messageId": message_id
    }
