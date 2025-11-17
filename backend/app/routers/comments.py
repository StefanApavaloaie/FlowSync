from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/assets", tags=["comments"])


def _get_asset_with_access_or_404(
    db: Session,
    user_id: int,
    asset_id: int,
) -> tuple[models.Asset, models.Project]:
    """
    Ensure the asset exists and user has access via project
    (owner or participant).
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
        return asset, project

    membership = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == project.id,
            models.ProjectParticipant.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this asset",
        )

    return asset, project


@router.get(
    "/{asset_id}/comments",
    response_model=List[schemas.CommentOut],
)
def list_comments(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    _asset, _project = _get_asset_with_access_or_404(db, current_user.id, asset_id)

    comments = (
        db.query(models.Comment)
        .join(models.User, models.Comment.user_id == models.User.id)
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
    _asset, _project = _get_asset_with_access_or_404(db, current_user.id, asset_id)

    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment content cannot be empty",
        )

    parent_id = payload.parent_id

    # If replying, check parent exists and belongs to the same asset
    if parent_id is not None:
        parent = (
            db.query(models.Comment)
            .filter(
                models.Comment.id == parent_id,
                models.Comment.asset_id == asset_id,
            )
            .first()
        )
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment not found for this asset",
            )

    comment = models.Comment(
        asset_id=asset_id,
        user_id=current_user.id,
        content=content,
        parent_id=parent_id,   # NEW
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Activity log (keep your existing code)
    display_name = current_user.display_name or current_user.email
    activity = models.Activity(
        project_id=_asset.project_id,
        user_id=current_user.id,
        type="comment_added",
        message=f"{display_name} commented on an asset.",
    )
    db.add(activity)
    db.commit()

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
    asset, project = _get_asset_with_access_or_404(db, current_user.id, asset_id)

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

    # Allow deletion if current user is comment author OR project owner
    if comment.user_id != current_user.id and project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to delete this comment",
        )

    db.delete(comment)
    db.commit()
    return


@router.post(
    "/{asset_id}/comments/{comment_id}/reactions",
    response_model=schemas.CommentOut,
    status_code=status.HTTP_200_OK,
)
def toggle_comment_reaction(
    asset_id: int,
    comment_id: int,
    payload: schemas.CommentReactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Toggle an emoji reaction on a comment.
    If the user already reacted with this emoji -> remove it.
    Otherwise -> add it.
    Returns the updated comment (with reactions).
    """
    asset, project = _get_asset_with_access_or_404(db, current_user.id, asset_id)

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

    emoji = (payload.emoji or "").strip()
    if not emoji:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Emoji is required",
        )

    existing = (
        db.query(models.CommentReaction)
        .filter(
            models.CommentReaction.comment_id == comment.id,
            models.CommentReaction.user_id == current_user.id,
            models.CommentReaction.emoji == emoji,
        )
        .first()
    )

    if existing:
        # remove reaction
        db.delete(existing)
        db.commit()
    else:
        # add reaction
        reaction = models.CommentReaction(
            comment_id=comment.id,
            user_id=current_user.id,
            emoji=emoji,
        )
        db.add(reaction)
        db.commit()

        # activity log only when adding
        display_name = current_user.display_name or current_user.email
        activity = models.Activity(
            project_id=project.id,
            user_id=current_user.id,
            type="comment_reacted",
            message=f"{display_name} reacted {emoji} to a comment.",
        )
        db.add(activity)
        db.commit()

    # reload comment with updated reactions
    updated_comment = (
        db.query(models.Comment)
        .filter(models.Comment.id == comment.id)
        .first()
    )
    return updated_comment
