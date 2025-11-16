from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/assets", tags=["comments"])


def _get_project_role_for_asset(
    db: Session,
    user_id: int,
    asset_id: int,
) -> tuple[models.Asset, str]:
    """
    Returns (asset, role) where role is 'owner' or 'collaborator'.
    Raises 404 if asset/project not found, 403 if user is not a member.
    """
    asset = (
        db.query(models.Asset)
        .join(models.Project, models.Asset.project_id == models.Project.id)
        .filter(models.Asset.id == asset_id)
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    project = asset.project

    if project.owner_id == user_id:
        return asset, "owner"

    participant = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == project.id,
            models.ProjectParticipant.user_id == user_id,
        )
        .first()
    )
    if participant:
        return asset, "collaborator"

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not a member of this project.",
    )


@router.get(
    "/{asset_id}/comments",
    response_model=List[schemas.CommentOut],
)
def list_comments(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    # Owner or collaborator can see comments
    _asset, _role = _get_project_role_for_asset(db, current_user.id, asset_id)

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
    # Owner or collaborator can add comments
    _asset, _role = _get_project_role_for_asset(db, current_user.id, asset_id)

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


@router.delete(
    "/{asset_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    asset_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    - Owner: can delete any comment on assets in their project.
    - Collaborator: can delete only comments they authored.
    """
    asset, role = _get_project_role_for_asset(db, current_user.id, asset_id)

    comment = (
        db.query(models.Comment)
        .filter(
            models.Comment.id == comment_id,
            models.Comment.asset_id == asset.id,
        )
        .first()
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    if role != "owner" and comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments.",
        )

    db.delete(comment)
    db.commit()
    return
