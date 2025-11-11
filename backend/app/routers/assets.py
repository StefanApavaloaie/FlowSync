import os
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/projects", tags=["assets"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_owned_project_or_404(
    db: Session,
    user_id: int,
    project_id: int,
) -> models.Project:
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
            detail="Project not found",
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
    Only the project owner is allowed.
    """
    project = _get_owned_project_or_404(db, current_user.id, project_id)

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
    ext = original_ext if original_ext in [".png", ".jpg", ".jpeg", ".webp"] else ".png"
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
        file_path=filename,  # store relative name only
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
    _ = _get_owned_project_or_404(db, current_user.id, project_id)

    assets = (
        db.query(models.Asset)
        .filter(models.Asset.project_id == project_id)
        .order_by(models.Asset.created_at.desc())
        .all()
    )
    return assets
