from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/invites", tags=["invites"])


def _require_project_owner(
    db: Session,
    project_id: int,
    user_id: int,
) -> models.Project:
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id)
        .first()
    )
    if not project or project.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you are not the owner.",
        )
    return project


@router.post(
    "/projects/{project_id}",
    response_model=schemas.ProjectInviteOut,
    status_code=status.HTTP_201_CREATED,
)
def invite_user_to_project(
    project_id: int,
    payload: schemas.ProjectInviteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Project owner invites a user by email.
    We store it as 'pending' and later the user can accept/decline.
    """
    project = _require_project_owner(db, project_id, current_user.id)

    invited_email = payload.invited_email.lower().strip()

    if invited_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself.",
        )

    # Check there's no other pending invite for same project+email
    existing = (
        db.query(models.ProjectInvite)
        .filter(
            models.ProjectInvite.project_id == project.id,
            models.ProjectInvite.invited_email == invited_email,
            models.ProjectInvite.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already a pending invite for this email.",
        )

    invited_user = (
        db.query(models.User)
        .filter(models.User.email == invited_email)
        .first()
    )

    invite = models.ProjectInvite(
        project_id=project.id,
        invited_email=invited_email,
        invited_user_id=invited_user.id if invited_user else None,
        invited_by_id=current_user.id,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@router.get(
    "/me",
    response_model=List[schemas.ProjectInviteOut],
)
def list_my_invites(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    "Notifications" endpoint.
    Returns all pending invites for the logged-in user (by email).
    """
    invites = (
        db.query(models.ProjectInvite)
        .filter(
            models.ProjectInvite.invited_email == current_user.email,
            models.ProjectInvite.status == "pending",
        )
        .order_by(models.ProjectInvite.created_at.desc())
        .all()
    )
    return invites


@router.post(
    "/{invite_id}/accept",
    response_model=schemas.ProjectInviteOut,
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
            detail="Invite not found.",
        )

    if invite.invited_email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite is not for you.",
        )

    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invite already {invite.status}.",
        )

    # Mark accepted
    invite.status = "accepted"
    invite.responded_at = datetime.utcnow()

    # Ensure membership exists
    membership = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == invite.project_id,
            models.ProjectParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
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
    response_model=schemas.ProjectInviteOut,
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
            detail="Invite not found.",
        )

    if invite.invited_email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite is not for you.",
        )

    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invite already {invite.status}.",
        )

    invite.status = "declined"
    invite.responded_at = datetime.utcnow()

    db.commit()
    db.refresh(invite)
    return invite
