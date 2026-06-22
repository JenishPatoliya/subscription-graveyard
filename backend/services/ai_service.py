# backend/services/ai_service.py
# Hybrid subscription detector: Rule-based first, AI fallback
# EXACT port of services/aiService.js (635 lines)

import re
from groq import Groq
from config.settings import get_settings

settings = get_settings()
groq_client = Groq(api_key=settings.GROQ_API_KEY)

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


# ═══════════════════════════════════════════════════════════════
# KNOWN SERVICES DATABASE (50+ services)
# ═══════════════════════════════════════════════════════════════

KNOWN_SERVICES = [
    # Entertainment
    {"name": "Netflix", "keywords": ["netflix"], "category": "Entertainment", "cancelUrl": "https://www.netflix.com/cancelplan"},
    {"name": "Amazon Prime", "keywords": ["amazon prime", "prime membership", "prime video"], "category": "Entertainment", "cancelUrl": "https://www.amazon.in/gp/primecentral"},
    {"name": "Disney+ Hotstar", "keywords": ["hotstar", "disney+", "disney plus"], "category": "Entertainment", "cancelUrl": "https://www.hotstar.com/account/subscription"},
    {"name": "Sony LIV", "keywords": ["sonyliv", "sony liv"], "category": "Entertainment", "cancelUrl": "https://www.sonyliv.com"},
    {"name": "ZEE5", "keywords": ["zee5"], "category": "Entertainment", "cancelUrl": "https://www.zee5.com"},
    {"name": "Hulu", "keywords": ["hulu"], "category": "Entertainment", "cancelUrl": "https://secure.hulu.com/account"},
    {"name": "HBO Max", "keywords": ["hbo max", "hbo"], "category": "Entertainment", "cancelUrl": "https://www.hbomax.com"},
    {"name": "Crunchyroll", "keywords": ["crunchyroll"], "category": "Entertainment", "cancelUrl": "https://www.crunchyroll.com/account"},
    {"name": "JioCinema", "keywords": ["jiocinema", "jio cinema"], "category": "Entertainment", "cancelUrl": "https://www.jiocinema.com"},
    # Music
    {"name": "Spotify Premium", "keywords": ["spotify"], "category": "Music", "cancelUrl": "https://www.spotify.com/account/subscription"},
    {"name": "YouTube Premium", "keywords": ["youtube premium", "youtube music", "yt premium"], "category": "Music", "cancelUrl": "https://www.youtube.com/paid_memberships"},
    {"name": "Apple Music", "keywords": ["apple music"], "category": "Music", "cancelUrl": "https://support.apple.com/en-in/HT202039"},
    {"name": "JioSaavn", "keywords": ["jiosaavn", "jio saavn", "saavn"], "category": "Music", "cancelUrl": "https://www.jiosaavn.com"},
    {"name": "Gaana Plus", "keywords": ["gaana"], "category": "Music", "cancelUrl": "https://gaana.com"},
    {"name": "Wynk Music", "keywords": ["wynk"], "category": "Music", "cancelUrl": "https://wynk.in"},
    # AI Tools
    {"name": "ChatGPT Plus", "keywords": ["chatgpt", "openai", "chat gpt"], "category": "AI Tools", "cancelUrl": "https://chat.openai.com/account/billing"},
    {"name": "Claude Pro", "keywords": ["claude", "anthropic"], "category": "AI Tools", "cancelUrl": "https://claude.ai/settings"},
    {"name": "Gemini Advanced", "keywords": ["gemini advanced", "google one ai"], "category": "AI Tools", "cancelUrl": "https://one.google.com"},
    {"name": "Midjourney", "keywords": ["midjourney"], "category": "AI Tools", "cancelUrl": "https://www.midjourney.com/account"},
    {"name": "Grammarly", "keywords": ["grammarly"], "category": "AI Tools", "cancelUrl": "https://account.grammarly.com/subscription"},
    {"name": "Jasper AI", "keywords": ["jasper ai", "jasper.ai"], "category": "AI Tools", "cancelUrl": "https://www.jasper.ai"},
    {"name": "Perplexity Pro", "keywords": ["perplexity"], "category": "AI Tools", "cancelUrl": "https://www.perplexity.ai"},
    # Design
    {"name": "Canva Pro", "keywords": ["canva"], "category": "Design", "cancelUrl": "https://www.canva.com/settings/purchase"},
    {"name": "Adobe Creative Cloud", "keywords": ["adobe", "creative cloud"], "category": "Design", "cancelUrl": "https://account.adobe.com/plans"},
    {"name": "Figma", "keywords": ["figma"], "category": "Design", "cancelUrl": "https://www.figma.com/settings"},
    # Productivity
    {"name": "Notion", "keywords": ["notion"], "category": "Productivity", "cancelUrl": "https://www.notion.so/profile/billing"},
    {"name": "Microsoft 365", "keywords": ["microsoft 365", "office 365", "microsoft subscription"], "category": "Productivity", "cancelUrl": "https://account.microsoft.com/services"},
    {"name": "Google One", "keywords": ["google one", "google storage"], "category": "Productivity", "cancelUrl": "https://one.google.com"},
    {"name": "iCloud+", "keywords": ["icloud"], "category": "Productivity", "cancelUrl": "https://support.apple.com/en-in/HT202039"},
    {"name": "Evernote", "keywords": ["evernote"], "category": "Productivity", "cancelUrl": "https://www.evernote.com/Settings.action"},
    {"name": "Todoist", "keywords": ["todoist"], "category": "Productivity", "cancelUrl": "https://todoist.com/app/settings/account"},
    {"name": "Zoom", "keywords": ["zoom"], "category": "Productivity", "cancelUrl": "https://zoom.us/account"},
    {"name": "Slack", "keywords": ["slack"], "category": "Productivity", "cancelUrl": "https://slack.com/account/settings"},
    # Security / VPN
    {"name": "NordVPN", "keywords": ["nordvpn", "nord vpn"], "category": "Security", "cancelUrl": "https://my.nordaccount.com/subscriptions"},
    {"name": "ExpressVPN", "keywords": ["expressvpn", "express vpn"], "category": "Security", "cancelUrl": "https://www.expressvpn.com/accounts"},
    {"name": "Surfshark", "keywords": ["surfshark"], "category": "Security", "cancelUrl": "https://my.surfshark.com/account"},
    {"name": "1Password", "keywords": ["1password"], "category": "Security", "cancelUrl": "https://my.1password.com/settings/billing"},
    {"name": "LastPass", "keywords": ["lastpass"], "category": "Security", "cancelUrl": "https://lastpass.com/account.php"},
    # Developer Tools
    {"name": "GitHub", "keywords": ["github"], "category": "Developer Tools", "cancelUrl": "https://github.com/settings/billing"},
    {"name": "GitLab", "keywords": ["gitlab"], "category": "Developer Tools", "cancelUrl": "https://gitlab.com/-/profile/billing"},
    {"name": "Vercel", "keywords": ["vercel"], "category": "Developer Tools", "cancelUrl": "https://vercel.com/account"},
    {"name": "Netlify", "keywords": ["netlify"], "category": "Developer Tools", "cancelUrl": "https://app.netlify.com/account/billing"},
    {"name": "Heroku", "keywords": ["heroku"], "category": "Developer Tools", "cancelUrl": "https://dashboard.heroku.com/account/billing"},
    {"name": "DigitalOcean", "keywords": ["digitalocean"], "category": "Developer Tools", "cancelUrl": "https://cloud.digitalocean.com/account/billing"},
    # Career
    {"name": "LinkedIn Premium", "keywords": ["linkedin premium", "linkedin"], "category": "Career", "cancelUrl": "https://www.linkedin.com/premium/manage-subscription"},
    # Storage
    {"name": "Dropbox", "keywords": ["dropbox"], "category": "Storage", "cancelUrl": "https://www.dropbox.com/account/plan"},
    {"name": "Google Drive", "keywords": ["google drive", "google storage"], "category": "Storage", "cancelUrl": "https://one.google.com"},
    {"name": "OneDrive", "keywords": ["onedrive"], "category": "Storage", "cancelUrl": "https://account.microsoft.com/services"},
    # Telecom (India)
    {"name": "Jio", "keywords": ["jio recharge", "jio plan", "reliance jio"], "category": "Telecom", "cancelUrl": "https://www.jio.com"},
    {"name": "Airtel", "keywords": ["airtel recharge", "airtel plan", "bharti airtel"], "category": "Telecom", "cancelUrl": "https://www.airtel.in"},
    # Education
    {"name": "Coursera Plus", "keywords": ["coursera"], "category": "Education", "cancelUrl": "https://www.coursera.org/account-settings"},
    {"name": "Skillshare", "keywords": ["skillshare"], "category": "Education", "cancelUrl": "https://www.skillshare.com/settings/payments"},
    {"name": "Duolingo Plus", "keywords": ["duolingo"], "category": "Education", "cancelUrl": "https://www.duolingo.com/settings/subscription"},
    {"name": "Unacademy", "keywords": ["unacademy"], "category": "Education", "cancelUrl": "https://unacademy.com"},
    # Fitness
    {"name": "Strava", "keywords": ["strava"], "category": "Fitness", "cancelUrl": "https://www.strava.com/account"},
    {"name": "Fitbit Premium", "keywords": ["fitbit"], "category": "Fitness", "cancelUrl": "https://www.fitbit.com/settings/subscription"},
    {"name": "Cult.fit", "keywords": ["cult.fit", "cultfit", "curefit"], "category": "Fitness", "cancelUrl": "https://www.cult.fit"},
    # News / Reading
    {"name": "Medium", "keywords": ["medium membership"], "category": "News", "cancelUrl": "https://medium.com/me/settings"},
    {"name": "The Ken", "keywords": ["the ken"], "category": "News", "cancelUrl": "https://the-ken.com"},
    {"name": "Kindle Unlimited", "keywords": ["kindle unlimited"], "category": "News", "cancelUrl": "https://www.amazon.in/kindle-dbs/hz/subscribe/ku"},
    {"name": "Audible", "keywords": ["audible"], "category": "News", "cancelUrl": "https://www.audible.in/account"},
]


# ═══════════════════════════════════════════════════════════════
# BLOCKED PATTERNS (definitely NOT subscriptions)
# ═══════════════════════════════════════════════════════════════

BLOCKED_SENDERS = [
    "noreply@reddit.com", "redditmail.com",
    "quora.com", "twitter.com", "x.com",
    "instagram.com", "facebook.com",
    "youtube.com/notification",
    "hello@mail.grammarly.com", "mail.grammarly.com",
    "newsletters-noreply@linkedin.com", "messages-noreply@linkedin.com",
    "e.linkedin.com", "linkedin.com/notification",
    "jobalerts-noreply@linkedin.com", "insights@",
    "angelone.in", "angelbroking.in",
    "zerodha.com", "kite.zerodha.com",
    "groww.in", "upstox.com",
    "icici.com", "icicidirect.com",
    "hdfcsec.com", "kotak.com",
    "motilal.com", "sharekhan.com",
    "5paisa.com", "dhan.co",
    "hdfcbank.com", "sbi.co.in", "icicibank.com",
    "axisbank.com", "kotak.com", "yesbank.in",
    "federalbank.co.in", "indusind.com",
    "nse.co.in", "bseindia.com",
    "join.netflix.com", "pinterest.com"
]

BLOCKED_SUBJECT_PHRASES = [
    "payment failed", "payment declined", "payment issue",
    "suspended due to", "needs attention", "update payment",
    "order shipped", "order delivered", "shipping confirmation",
    "delivery update", "tracking number", "out for delivery",
    "verify your", "confirm your email", "one-time password",
    "otp", "login alert",
    "weekly update", "weekly writing update", "weekly report",
    "insights", "writing update", "jump back in",
    "newsletter", "digest", "your weekly", "weekly digest",
    "free for", "free trial", "try a", "try our",
    "start your free", "get started free", "days free",
    "special offer", "limited time", "discount",
    "save with", "upgrade now", "unlock premium",
    "introducing", "what's new", "tips for",
    "welcome to", "getting started", "learn more",
    "we miss you", "come back", "win a", "giveaway",
    "ipo", "allotment", "refund",
    "mutual fund", "sip", "nifty", "sensex",
    "stock", "shares", "trading",
    "credit card statement", "account statement",
    "bank statement", "transaction alert",
    "funds/securities", "demat",
    "market", "portfolio",
    "terms of service", "updating our", "privacy policy",
    "valued member", "thanks for being"
]

CANCELLATION_PHRASES = [
    "has been cancelled", "has been canceled",
    "membership has been cancelled", "membership has been canceled",
    "subscription has been cancelled", "subscription has been canceled",
    "sorry to see you go", "you have cancelled", "you have canceled",
    "cancellation confirmed", "successfully cancelled", "successfully canceled",
    "will remain active until", "access until",
    "you've cancelled", "you've canceled"
]


# ═══════════════════════════════════════════════════════════════
# AMOUNT EXTRACTION
# ═══════════════════════════════════════════════════════════════

def extract_amount(text: str) -> float | None:
    if not text:
        return None

    patterns = [
        r"₹\s*([\d,]+(?:\.\d{1,2})?)",
        r"Rs\.?\s*([\d,]+(?:\.\d{1,2})?)",
        r"INR\s*([\d,]+(?:\.\d{1,2})?)",
        r"amount\s*(?:charged|paid|due|is|was|of|:)\s*₹?\s*(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)",
        r"(?:price|cost|fee|charge|total)\s*(?:is|was|of|:)\s*₹?\s*(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)",
        r"\$\s*([\d,]+(?:\.\d{1,2})?)",
        r"USD\s*([\d,]+(?:\.\d{1,2})?)",
        r"[€£]\s*([\d,]+(?:\.\d{1,2})?)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount = float(match.group(1).replace(",", ""))
            if 0 < amount < 1000000:
                return amount

    return None


# ═══════════════════════════════════════════════════════════════
# CURRENCY DETECTION
# ═══════════════════════════════════════════════════════════════

def detect_currency(text: str) -> str:
    if not text:
        return "INR"
    lower = text.lower()
    if "₹" in lower or "inr" in lower or re.search(r"rs\.?\s*\d", lower, re.IGNORECASE):
        return "INR"
    if "$" in lower or "usd" in lower:
        return "USD"
    if "€" in lower or "eur" in lower:
        return "EUR"
    if "£" in lower or "gbp" in lower:
        return "GBP"
    return "INR"


# ═══════════════════════════════════════════════════════════════
# DATE EXTRACTION
# ═══════════════════════════════════════════════════════════════

MONTHS = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "jun": "06", "jul": "07", "aug": "08", "sep": "09",
    "oct": "10", "nov": "11", "dec": "12"
}


def parse_natural_date(text: str) -> str | None:
    if not text:
        return None

    # "June 5, 2026" or "Jun 5, 2026"
    match = re.search(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})", text, re.IGNORECASE)
    if match:
        month = MONTHS.get(match.group(1).lower())
        if month:
            day = match.group(2).zfill(2)
            return f"{match.group(3)}-{month}-{day}"

    # "5 June 2026"
    match = re.search(r"(\d{1,2})\s+(\w+)\s+(\d{4})", text, re.IGNORECASE)
    if match:
        month = MONTHS.get(match.group(2).lower())
        if month:
            day = match.group(1).zfill(2)
            return f"{match.group(3)}-{month}-{day}"

    # "2026-06-05"
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    # "05/06/2026" (DD/MM/YYYY)
    match = re.search(r"(\d{2})/(\d{2})/(\d{4})", text)
    if match:
        return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"

    return None


def extract_receipt_date(text: str, email_date: str = None) -> str | None:
    if not text:
        return parse_natural_date(email_date) if email_date else None

    date_patterns = [
        r"(?:date\s*(?:charged|of charge)?|charged on|payment date|date paid|billed on|transaction date)\s*[:\-]?\s*(.+?)(?:\n|$|\.)",
        r"(?:date)\s*[:\-]\s*(.+?)(?:\n|$|\.)",
    ]

    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            parsed = parse_natural_date(match.group(1).strip())
            if parsed:
                return parsed

    if email_date:
        return parse_natural_date(email_date)
    return None


def extract_renewal_date(text: str) -> str | None:
    if not text:
        return None

    patterns = [
        r"(?:next billing|next renewal|next payment|renews on|renews|next charge|billing event|next billing event|scheduled for)\s*(?:date)?[:\-]?\s*(?:is\s*(?:on\s*|scheduled\s*(?:for\s*)?)?)?\s*(.+?)(?:\n|$|\.|,)",
        r"(?:will be charged on|will renew on|renewal date)\s*[:\-]?\s*(.+?)(?:\n|$|\.|,)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            parsed = parse_natural_date(match.group(1).strip())
            if parsed:
                return parsed
    return None


# ═══════════════════════════════════════════════════════════════
# SERVICE DETECTION
# ═══════════════════════════════════════════════════════════════

def detect_known_service(text: str) -> dict | None:
    lower = text.lower()
    best_match = None
    best_keyword_length = 0

    for service in KNOWN_SERVICES:
        for keyword in service["keywords"]:
            if keyword in lower:
                if len(keyword) > best_keyword_length:
                    best_keyword_length = len(keyword)
                    best_match = service

    return best_match


# ═══════════════════════════════════════════════════════════════
# PRE-FILTERS
# ═══════════════════════════════════════════════════════════════

def is_blocked_sender(from_addr: str) -> bool:
    lower = from_addr.lower()
    return any(blocked in lower for blocked in BLOCKED_SENDERS)


def is_blocked_subject(subject: str) -> bool:
    lower = subject.lower()
    return any(phrase in lower for phrase in BLOCKED_SUBJECT_PHRASES)


def is_cancellation(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in CANCELLATION_PHRASES)


def has_subscription_signals(text: str) -> bool:
    lower = text.lower()
    signals = [
        "payment processed", "payment successful", "successfully processed",
        "payment confirmed", "processed your payment",
        "subscription renewed", "has been renewed", "renewal",
        "receipt", "invoice", "charged", "billed",
        "amount paid", "amount charged", "amount:", "amount due",
        "billing event", "next billing", "billing date",
        "payment method", "card ending", "ending in",
        "thank you for your payment", "transaction successful",
        "deducted", "debited", "auto-debit", "auto debit",
        "plan activated", "plan renewed",
        "recurring", "auto-renew"
    ]
    return any(signal in lower for signal in signals)


# ═══════════════════════════════════════════════════════════════
# AI FALLBACK (for unknown services)
# ═══════════════════════════════════════════════════════════════

def get_category(service_name: str) -> str:
    lower = (service_name or "").lower()
    category_map = {
        "Entertainment": ["netflix", "prime", "hotstar", "disney", "hulu", "hbo", "sonyliv", "zee5", "jiocinema", "crunchyroll"],
        "Music": ["spotify", "music", "jiosaavn", "gaana", "wynk", "youtube music"],
        "AI Tools": ["chatgpt", "openai", "claude", "anthropic", "gemini", "midjourney", "grammarly", "jasper", "perplexity"],
        "Design": ["canva", "adobe", "figma", "photoshop", "illustrator"],
        "Productivity": ["notion", "microsoft", "office", "google one", "icloud", "evernote", "todoist", "zoom", "slack"],
        "Security": ["nordvpn", "expressvpn", "surfshark", "1password", "lastpass", "vpn"],
        "Developer Tools": ["github", "gitlab", "vercel", "netlify", "heroku", "digitalocean"],
        "Career": ["linkedin"],
        "Storage": ["dropbox", "drive", "onedrive", "storage"],
        "Telecom": ["jio", "airtel", "vi ", "bsnl", "vodafone"],
        "Education": ["coursera", "udemy", "skillshare", "duolingo", "unacademy"],
        "Fitness": ["strava", "fitbit", "cult.fit", "peloton"],
    }
    for cat, keywords in category_map.items():
        if any(k in lower for k in keywords):
            return cat
    return "Other"


def get_cancel_url(service_name: str) -> str | None:
    service = detect_known_service(service_name)
    return service["cancelUrl"] if service else None


async def ask_ai(email_data: dict) -> dict:
    """AI fallback for unknown services — mirrors askAI()"""
    subject = email_data.get("subject", "")
    from_addr = email_data.get("from", "")
    body = email_data.get("body", "") or email_data.get("snippet", "")
    content = body[:2000]

    prompt = f"""Extract subscription info from this email as JSON only.

Subject: {subject}
From: {from_addr}
Body: {content}

Respond with ONLY this JSON (no other text):
{{"isSubscription":true,"serviceName":"Example","amount":100,"currency":"INR","receiptDate":"2026-01-01","renewalDate":"2026-02-01"}}

Use null for unknown fields. isSubscription=false if not a recurring payment."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "Respond with ONLY valid JSON. No text, no markdown, no explanation. Just a single JSON object."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=250,
            temperature=0
        )

        text = response.choices[0].message.content.strip()
        print(f"  AI raw: {text[:150]}")

        parsed = None

        # Strategy 1: Direct parse
        try:
            clean = re.sub(r"```json\s*", "", text)
            clean = re.sub(r"```\s*", "", clean).strip()
            import json
            parsed = json.loads(clean)
        except Exception:
            pass

        # Strategy 2: Extract first JSON object
        if not parsed:
            json_match = re.search(r"\{[^{}]*\}", text)
            if json_match:
                try:
                    clean = re.sub(r",\s*}", "}", json_match.group(0))
                    import json
                    parsed = json.loads(clean)
                except Exception:
                    pass

        # Strategy 3: Manual field extraction
        if not parsed:
            is_sub = bool(re.search(r'isSubscription["\s:]+true', text, re.IGNORECASE))
            name_match = re.search(r'serviceName["\s:]+["\']([^"\']+)["\']', text, re.IGNORECASE)
            amount_match = re.search(r'amount["\s:]+(\d[\d,.]*)', text, re.IGNORECASE)

            if is_sub and name_match:
                parsed = {
                    "isSubscription": True,
                    "serviceName": name_match.group(1),
                    "amount": float(amount_match.group(1).replace(",", "")) if amount_match else None,
                    "currency": "INR",
                    "receiptDate": None,
                    "renewalDate": None
                }

        if parsed and parsed.get("isSubscription") and parsed.get("serviceName"):
            service = detect_known_service(parsed["serviceName"])
            parsed["category"] = service["category"] if service else get_category(parsed["serviceName"])
            parsed["cancelUrl"] = service["cancelUrl"] if service else get_cancel_url(parsed["serviceName"])
            return parsed

        return {"isSubscription": False}

    except Exception as err:
        print(f"  AI error: {err}")
        return {"isSubscription": False}


# ═══════════════════════════════════════════════════════════════
# MAIN DETECTION FUNCTION
# ═══════════════════════════════════════════════════════════════

async def parse_email_for_subscription(email_data: dict) -> dict:
    """Main email parsing function — mirrors parseEmailForSubscription()"""
    subject = email_data.get("subject", "")
    from_addr = email_data.get("from", "")
    date = email_data.get("date", "")
    snippet = email_data.get("snippet", "")
    body = email_data.get("body", "")

    full_text = f"{subject} {from_addr} {body or snippet or ''}"
    content_only = body or snippet or ""

    print(f"\n--- Processing email ---")
    print(f"  Subject: {subject}")
    print(f"  From: {from_addr}")

    # ─── STEP 1: Quick rejection ───
    if is_blocked_sender(from_addr):
        print("  → BLOCKED sender")
        return {"isSubscription": False}

    if is_blocked_subject(subject):
        print("  → BLOCKED subject")
        return {"isSubscription": False}

    # Check for promotional/trial language
    promo_patterns = [
        "free for", "days free", "free trial", "try a",
        "try our", "start your free", "get started free",
        "special offer", "limited time", "discount",
        "save with", "upgrade now", "unlock premium",
        "introducing", "what's new", "tips for",
        "welcome to", "getting started", "learn more",
        "we miss you", "come back", "win a", "giveaway",
        "weekly insight", "upgrade today", "try premium",
        "unlock suggestions"
    ]
    combined_lower = f"{subject} {content_only}".lower()
    has_strong_receipt = any(phrase in combined_lower for phrase in [
        "payment processed", "successfully processed",
        "payment successful", "payment confirmed",
        "transaction successful", "order receipt",
        "payment receipt", "subscription renewed",
        "successfully charged"
    ])

    is_promo = any(p in combined_lower for p in promo_patterns) and not has_strong_receipt

    if is_promo:
        print("  → SKIPPED: Promotional/trial email")
        return {"isSubscription": False}

    if is_cancellation(full_text):
        print("  → CANCELLATION email")
        return {"isSubscription": False}

    # ─── STEP 2: Try known service detection ───
    service = detect_known_service(full_text)

    if service:
        print(f"  → KNOWN SERVICE detected: {service['name']}")

        if not has_subscription_signals(full_text):
            print("  → SKIPPED: No payment signals (likely promo email)")
            return {"isSubscription": False}

        amount = extract_amount(content_only)

        content_lower = content_only.lower()
        has_strong_billing_proof = any(phrase in content_lower for phrase in [
            "payment processed", "successfully processed",
            "payment successful", "next billing",
            "billing event", "card ending",
            "ending in", "payment method",
            "has been renewed", "subscription renewed",
            "auto-renew"
        ])

        if not amount and not has_strong_billing_proof:
            print("  → SKIPPED: No amount and no strong billing proof")
            return {"isSubscription": False}

        currency = detect_currency(content_only)
        receipt_date = extract_receipt_date(content_only, date)
        renewal_date = extract_renewal_date(content_only)

        print(f"  → Amount: {amount} {currency}")
        print(f"  → Receipt date: {receipt_date}")
        print(f"  → Renewal date: {renewal_date}")

        return {
            "isSubscription": True,
            "serviceName": service["name"],
            "amount": amount,
            "currency": currency,
            "category": service["category"],
            "cancelUrl": service["cancelUrl"],
            "receiptDate": receipt_date,
            "renewalDate": renewal_date
        }

    # ─── STEP 3: Unknown service - try AI ───
    if has_subscription_signals(full_text):
        print("  → Has subscription signals, trying AI...")
        result = await ask_ai(email_data)

        if result.get("isSubscription"):
            result["amount"] = result.get("amount") or extract_amount(content_only)
            result["currency"] = result.get("currency") or detect_currency(content_only)
            result["receiptDate"] = result.get("receiptDate") or extract_receipt_date(content_only, date)
            result["renewalDate"] = result.get("renewalDate") or extract_renewal_date(content_only)
            print(f"  → AI detected: {result.get('serviceName')} {result.get('amount')}")
            return result

    print("  → NOT a subscription")
    return {"isSubscription": False}
