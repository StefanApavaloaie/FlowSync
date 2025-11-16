from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/invites", tags=["invites"])


@router.get(
    "/pending",
    response_model=List[schemas.ProjectInviteWithDetailsOut],
)
def list_pending_invites(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    All pending invites for the current user.
    Matched either by invited_user_id or invited_email.
    """
    invites = (
        db.query(models.ProjectInvite)
        .join(models.Project, models.ProjectInvite.project_id == models.Project.id)
        .join(models.User, models.ProjectInvite.invited_by_id == models.User.id)
        .filter(
            models.ProjectInvite.status == "pending",
            (
                (models.ProjectInvite.invited_user_id == current_user.id)
                | (
                    (models.ProjectInvite.invited_user_id.is_(None))
                    & (models.ProjectInvite.invited_email == current_user.email)
                )
            ),
        )
        .order_by(models.ProjectInvite.created_at.desc())
        .all()
    )
    return invites


def _ensure_can_act_on_invite(
    invite: models.ProjectInvite,
    user: models.User,
) -> None:
    if invite.invited_user_id is not None:
        if invite.invited_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to act on this invite",
            )
    else:
        if invite.invited_email != user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to act on this invite",
            )
        # Link invite to this user now
        invite.invited_user_id = user.id


@router.post(
    "/{invite_id}/accept",
    response_model=schemas.ProjectInviteWithDetailsOut,
)
def accept_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    invite = (
        db.query(models.ProjectInvite)
        .filter(models.ProjectInvite.id == invite_id)
        .first()
    )
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite is not pending",
        )

    _ensure_can_act_on_invite(invite, current_user)

    invite.status = "accepted"
    invite.responded_at = datetime.utcnow()

    # Ensure membership exists
    existing = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == invite.project_id,
            models.ProjectParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not existing:
        membership = models.ProjectParticipant(
            project_id=invite.project_id,
            user_id=current_user.id,
            role="member",
        )
        db.add(membership)

    db.commit()
    db.refresh(invite)
    return invite


@router.post(
    "/{invite_id}/decline",
    response_model=schemas.ProjectInviteWithDetailsOut,
)
def decline_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    invite = (
        db.query(models.ProjectInvite)
        .filter(models.ProjectInvite.id == invite_id)
        .first()
    )
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite is not pending",
        )

    _ensure_can_act_on_invite(invite, current_user)

    invite.status = "declined"
    invite.responded_at = datetime.utcnow()

    db.commit()
    db.refresh(invite)
    return invite
