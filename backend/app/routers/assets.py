# backend/routers/assets.py

import os
from typing import List
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/projects", tags=["assets"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_project_for_user_or_404(
    db: Session,
    user_id: int,
    project_id: int,
) -> models.Project:
    """
    Return the project if the user has access (owner OR collaborator),
    otherwise raise 404.
    """
    project = (
        db.query(models.Project)
        .outerjoin(
            models.ProjectParticipant,
            models.ProjectParticipant.project_id == models.Project.id,
        )
        .filter(
            models.Project.id == project_id,
            or_(
                models.Project.owner_id == user_id,
                models.ProjectParticipant.user_id == user_id,
            ),
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you don't have access.",
        )

    return project


def _get_project_for_owner_or_404(
    db: Session,
    user_id: int,
    project_id: int,
) -> models.Project:
    """
    Strict owner-only check (for destructive actions like deleting assets).
    """
    project = (
        db.query(models.Project)
        .filter(
            models.Project.id == project_id,
            models.Project.owner_id == user_id,
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you are not the owner.",
        )

    return project


@router.post(
    "/{project_id}/assets",
    response_model=schemas.AssetOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_asset(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Upload an image asset for a given project.

    Allowed:
      - project owner
      - collaborators (ProjectParticipant rows)
    """
    project = _get_project_for_user_or_404(db, current_user.id, project_id)

    if file.content_type not in (
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads are allowed.",
        )

    # Build file name
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    original_ext = os.path.splitext(file.filename or "")[1].lower()
    ext = (
        original_ext
        if original_ext in [".png", ".jpg", ".jpeg", ".webp"]
        else ".png"
    )
    filename = f"project_{project.id}_{timestamp}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    # Save file to disk
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Compute version number
    current_count = (
        db.query(models.Asset)
        .filter(models.Asset.project_id == project.id)
        .count()
    )

    asset = models.Asset(
    project_id=project.id,
    user_id=current_user.id,       # NEW – the uploader
    file_path=filename,            # relative filename
    version=current_count + 1,
    )


    db.add(asset)
    db.commit()
    db.refresh(asset)

    return asset


@router.get(
    "/{project_id}/assets",
    response_model=List[schemas.AssetOut],
)
def list_assets(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    List assets for a project.

    Allowed:
      - project owner
      - collaborators
    """
    _ = _get_project_for_user_or_404(db, current_user.id, project_id)

    assets = (
        db.query(models.Asset)
        .filter(models.Asset.project_id == project_id)
        .order_by(models.Asset.created_at.desc())
        .all()
    )
    return assets


@router.delete(
    "/{project_id}/assets/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_asset(
    project_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Delete an asset and its file.

    For now we keep this OWNER-ONLY (collaborators can upload but not delete
    other people's assets). Later we can extend with per-uploader rules.
    """
    project = _get_project_for_owner_or_404(db, current_user.id, project_id)

    asset = (
        db.query(models.Asset)
        .filter(
            models.Asset.id == asset_id,
            models.Asset.project_id == project.id,
        )
        .first()
    )

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found.",
        )

    # Delete comments for this asset
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.asset_id == asset.id)
        .all()
    )
    for c in comments:
        db.delete(c)

    # Delete the file on disk
    if asset.file_path:
        file_path = os.path.join(UPLOAD_DIR, asset.file_path)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                # Ignore disk errors in this MVP
                pass

    db.delete(asset)
    db.commit()
