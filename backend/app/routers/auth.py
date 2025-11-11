import httpx
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from .. import models
from ..deps import get_db, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/url")
def get_google_oauth_url():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_REDIRECT_URI:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth not configured",
        )

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }

    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {"url": url}


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    # Exchange code for tokens
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data=data)

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get tokens from Google")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Missing access token from Google")

    # Fetch user info
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(GOOGLE_USERINFO_URL, headers=headers)

    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    userinfo = userinfo_resp.json()
    google_id = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name")

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Invalid Google user info")

    # Find or create user
    user = db.query(models.User).filter(models.User.google_id == google_id).first()

    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_id = google_id
            if not user.display_name:
                user.display_name = name
        else:
            user = models.User(
                email=email,
                google_id=google_id,
                display_name=name,
                password_hash=None,
            )
            db.add(user)

        db.commit()
        db.refresh(user)

    # Create internal JWT for FlowSync
    internal_token = create_access_token({"sub": str(user.id)})

    # Redirect to frontend with token (MVP approach)
    redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={internal_token}"
    return RedirectResponse(url=redirect_url)


@router.get("/me")
def get_me(
    token: str = Query(..., description="JWT returned from Google callback"),
    db: Session = Depends(get_db),
):
    """
    Debug endpoint: given a JWT, return the associated user.
    Later we'll switch to Authorization header.
    """
    user = get_current_user(token=token, db=db)
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "google_id": user.google_id,
        "created_at": user.created_at,
    }
