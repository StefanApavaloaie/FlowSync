import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .. import models
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/assets", tags=["ai"])

UPLOAD_DIR = "uploads"


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
    Return simple AI suggestions for an asset.
    Accessible to both project owners and collaborators.
    """
    asset = _get_asset_for_user_or_404(db, current_user.id, asset_id)

    image_path = os.path.join(UPLOAD_DIR, asset.file_path)
    if not os.path.exists(image_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset image file not found on server",
        )

    # Stubbed suggestions – you can later plug in a real AI model here.
    suggestions: List[str] = [
        "Check the overall crop and try centering the main subject.",
        "Consider slightly increasing brightness and contrast for more clarity.",
        "Experiment with a subtle vignette to focus attention on the center.",
        "If this is for UI/UX, ensure there is enough padding around key elements.",
        "Try a warmer color balance for a more inviting look.",
    ]

    return {"suggestions": suggestions}
