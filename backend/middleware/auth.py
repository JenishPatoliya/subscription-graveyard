# backend/middleware/auth.py
# JWT authentication dependency — replaces middleware/authMiddleware.js

from fastapi import Request, HTTPException, Depends
from jose import jwt, JWTError, ExpiredSignatureError
from config.settings import get_settings

settings = get_settings()


async def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency that extracts and verifies JWT from cookies.
    Equivalent to the Node.js 'protect' middleware.
    Attaches user info to request state.
    """
    token = request.cookies.get("token")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not logged in. Please sign in."
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return {
            "userId": payload.get("userId"),
            "email": payload.get("email"),
            "plan": payload.get("plan"),
            "isDemo": payload.get("isDemo", False)
        }

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid session. Please sign in again."
        )
