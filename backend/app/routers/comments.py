from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/assets", tags=["comments"])


def _get_owned_asset_or_404(
    db: Session,
    user_id: int,
    asset_id: int,
) -> models.Asset:
    """
    Ensure the asset exists and belongs to a project owned by this user.
    """
    asset = (
        db.query(models.Asset)
        .join(models.Project, models.Asset.project_id == models.Project.id)
        .filter(
            models.Asset.id == asset_id,
            models.Project.owner_id == user_id,
        )
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )
    return asset


@router.get(
    "/{asset_id}/comments",
    response_model=List[schemas.CommentOut],
)
def list_comments(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    _ = _get_owned_asset_or_404(db, current_user.id, asset_id)

    comments = (
        db.query(models.Comment)
        .filter(models.Comment.asset_id == asset_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )
    return comments


@router.post(
    "/{asset_id}/comments",
    response_model=schemas.CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    asset_id: int,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    _ = _get_owned_asset_or_404(db, current_user.id, asset_id)

    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment content cannot be empty",
        )

    comment = models.Comment(
        asset_id=asset_id,
        user_id=current_user.id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
