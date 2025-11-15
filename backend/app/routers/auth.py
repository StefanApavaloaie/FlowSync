import httpx
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from ..config import settings
from .. import models
from ..deps import get_db, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# Expose BOTH endpoints to be compatible with any frontend code
@router.get("/google/url")
@router.get("/google/login")
def get_google_oauth_url():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    # return both keys so older handlers work
    return {"url": url, "auth_url": url}

@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        code = request.query_params.get("code")
        if not code:
            raise HTTPException(status_code=400, detail="Missing code")

        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data=data, timeout=15)
        if token_resp.status_code != 200:
            return JSONResponse(status_code=400, content={
                "detail": "Google token exchange failed",
                "google_status": token_resp.status_code,
                "google_body": token_resp.text,
            })

        access_token = token_resp.json().get("access_token")
        if not access_token:
            return JSONResponse(status_code=400, content={
                "detail": "Missing access_token", "google_body": token_resp.text
            })

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            userinfo_resp = await client.get(GOOGLE_USERINFO_URL, headers=headers, timeout=15)
        if userinfo_resp.status_code != 200:
            return JSONResponse(status_code=400, content={
                "detail": "Failed to fetch userinfo",
                "google_status": userinfo_resp.status_code,
                "google_body": userinfo_resp.text,
            })

        info = userinfo_resp.json()
        email = info.get("email")
        name = info.get("name")
        picture = info.get("picture")
        if not email:
            return JSONResponse(status_code=400, content={
                "detail": "No email in Google profile", "userinfo": info
            })

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email, display_name=name, picture=picture)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            changed = False
            if name and user.display_name != name:
                user.display_name = name; changed = True
            if picture and user.picture != picture:
                user.picture = picture; changed = True
            if changed:
                db.add(user); db.commit(); db.refresh(user)

        token = create_access_token({"sub": str(user.id)})
        redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={token}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        # Return the exact error so we can see what the DB complained about
        return JSONResponse(status_code=500, content={"detail": f"{type(e).__name__}: {e}"})


@router.get("/me")
def get_me(token: str, db: Session = Depends(get_db)):
    """
    Debug endpoint: given a JWT (as query param `token`), return the associated user.
    Keep for now to simplify your callback page; we can switch to Authorization header later.
    """
    from ..deps import get_current_user
    user = get_current_user(token=token, db=db)
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "created_at": user.created_at,
    }
