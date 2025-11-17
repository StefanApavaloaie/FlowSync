# backend/app/routers/ai.py
import os
import base64
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

import openai
from openai import OpenAI

from .. import models
from ..deps import get_db, get_current_user_from_header
from ..config import settings

router = APIRouter(prefix="/assets", tags=["ai"])

UPLOAD_DIR = "uploads"

# OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _get_asset_for_user_or_404(
    db: Session,
    user_id: int,
    asset_id: int,
) -> models.Asset:
    """
    Asset is visible if the user is:
    - the project owner, OR
    - a participant (collaborator) on that project.
    """
    asset = (
        db.query(models.Asset)
        .join(models.Project, models.Asset.project_id == models.Project.id)
        .outerjoin(
            models.ProjectParticipant,
            and_(
                models.ProjectParticipant.project_id == models.Project.id,
                models.ProjectParticipant.user_id == user_id,
            ),
        )
        .filter(
            models.Asset.id == asset_id,
            or_(
                models.Project.owner_id == user_id,
                models.ProjectParticipant.id.isnot(None),
            ),
        )
        .first()
    )

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    return asset


@router.get("/{asset_id}/ai-suggestions")
def get_ai_suggestions(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Return AI suggestions for an asset image (owner + collaborators).
    Uses OpenAI Vision (gpt-4o-mini).
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI is not configured on the server (missing API key).",
        )

    asset = _get_asset_for_user_or_404(db, current_user.id, asset_id)

    image_path = os.path.join(UPLOAD_DIR, asset.file_path)
    if not os.path.exists(image_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset image file not found on server",
        )

    # Detect mime type from file extension
    ext = os.path.splitext(asset.file_path.lower())[1]
    if ext in [".jpg", ".jpeg"]:
        mime = "image/jpeg"
    elif ext == ".webp":
        mime = "image/webp"
    else:
        mime = "image/png"

    try:
        # Read image and encode as base64 data URL
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime};base64,{b64}"

        prompt = (
            "You are a design review assistant helping a team give feedback on a document. "
        "Analyze the attached image and return 3–7 short, concrete suggestions on how to "
        "improve it for UI/UX, visual clarity, or presentation. "
        "Be specific (e.g., 'increase padding around buttons', 'align text with grid', "
        "'brighten background slightly'), and assume a generic web/app context. If the file is not an image and is a word document or pdf or excel sheet,"
        " provide suggestions for improving the document's layout, formatting, or content clarity."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You provide concise, actionable design feedback.",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                },
            ],
            temperature=0.4,
        )

        text = response.choices[0].message.content or ""
        # Turn the model output into a clean list of suggestions
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        suggestions: List[str] = []
        for line in lines:
            # Strip leading bullets / numbering
            cleaned = line.lstrip("-•").strip()
            # Remove leading "1.", "2)" etc.
            if cleaned[:2].isdigit():
                cleaned = cleaned[2:].lstrip("). ").strip()
            suggestions.append(cleaned)

        if not suggestions:
            # Fallback if parsing fails
            if text.strip():
                suggestions = [text.strip()]
            else:
                suggestions = [
                    "Increase brightness and contrast for better visibility.",
                    "Crop slightly to center the main subject.",
                    "Reduce background distractions to keep focus on the subject.",
                ]

    except openai.AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI authentication failed. Check the server API key.",
        )
    except openai.RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI rate limit reached. Please try again in a bit.",
        )
    except (openai.APIError, openai.APIConnectionError) as e:
        # Log to server console for debugging
        print("OpenAI API error:", repr(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to call AI service.",
        )
    except Exception as e:
        # Generic unknown error
        print("Unexpected AI error:", repr(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while generating AI suggestions.",
        )

    return {"suggestions": suggestions}
