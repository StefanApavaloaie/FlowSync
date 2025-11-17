# backend/app/routers/assets.py

import os
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/projects", tags=["assets"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---- allowed MIME types & extensions ----

IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}

DOC_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",  # .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.ms-excel",  # .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
}

ALLOWED_CONTENT_TYPES = IMAGE_CONTENT_TYPES | DOC_CONTENT_TYPES

ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
}


def _get_project_for_user_with_access_or_404(
    db: Session,
    user_id: int,
    project_id: int,
) -> models.Project:
    """
    Project is visible if the user is:
    - the project owner, OR
    - a participant (collaborator) on that project.
    """
    project = (
        db.query(models.Project)
        .outerjoin(
            models.ProjectParticipant,
            and_(
                models.ProjectParticipant.project_id == models.Project.id,
                models.ProjectParticipant.user_id == user_id,
            ),
        )
        .filter(
            models.Project.id == project_id,
            or_(
                models.Project.owner_id == user_id,
                models.ProjectParticipant.id.isnot(None),
            ),
        )
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied",
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
    Upload an asset for a given project.

    Owner + collaborators can upload.
    Allowed: images (png/jpg/jpeg/webp), PDF, Word, Excel.
    """
    project = _get_project_for_user_with_access_or_404(
        db, current_user.id, project_id
    )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported file type. "
                "Allowed: PNG, JPG/JPEG, WEBP, PDF, Word (.doc/.docx), Excel (.xls/.xlsx)."
            ),
        )

    # Build filename – keep original extension when it's allowed
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    original_name = file.filename or "asset"
    original_ext = os.path.splitext(original_name)[1].lower()
    ext = original_ext if original_ext in ALLOWED_EXTENSIONS else ""

    filename = f"project_{project.id}_{timestamp}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    # Save file
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
        user_id=current_user.id,
        file_path=filename,  # relative filename
        version=current_count + 1,
    )

    db.add(asset)
    db.commit()
    db.refresh(asset)

    # Activity log: asset uploaded
    display_name = current_user.display_name or current_user.email
    activity = models.Activity(
        project_id=project.id,
        user_id=current_user.id,
        type="asset_uploaded",
        message=f"{display_name} uploaded an asset.",
    )
    db.add(activity)
    db.commit()

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
    _ = _get_project_for_user_with_access_or_404(db, current_user.id, project_id)

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
    Delete asset (and comments + file) – owner only.
    """
    # Owner only
    project = (
        db.query(models.Project)
        .filter(
            models.Project.id == project_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can delete assets",
        )

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
            detail="Asset not found",
        )

    # Delete comments for this asset
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.asset_id == asset.id)
        .all()
    )
    for comment in comments:
        db.delete(comment)

    # Delete associated file if it exists
    if asset.file_path:
        disk_path = os.path.join(UPLOAD_DIR, asset.file_path)
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except OSError:
                # ignore file delete errors
                pass

    db.delete(asset)
    db.commit()
    return
