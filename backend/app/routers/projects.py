import os
from typing import List
from datetime import datetime 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/projects", tags=["projects"])

UPLOAD_DIR = "uploads"


def _get_project_or_404(db: Session, project_id: int) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _ensure_owner(project: models.Project, user_id: int) -> None:
    if project.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can perform this action",
        )


def _ensure_can_view_project(db: Session, project: models.Project, user_id: int) -> None:
    """
    Owner or participant.
    """
    if project.owner_id == user_id:
        return
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
            detail="You don't have access to this project",
        )


@router.get("/", response_model=List[schemas.ProjectOut])
def list_projects(
    archived: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    q = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id
    )

    if archived:
        q = q.filter(models.Project.is_archived.is_(True))
    else:
        q = q.filter(models.Project.is_archived.is_(False))

    projects = q.order_by(models.Project.created_at.desc()).all()
    return projects


@router.get("/shared-with-me", response_model=List[schemas.ProjectOut])
def list_shared_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Projects where current user is a participant (not owner).
    """
    projects = (
        db.query(models.Project)
        .join(
            models.ProjectParticipant,
            models.ProjectParticipant.project_id == models.Project.id,
        )
        .filter(models.ProjectParticipant.user_id == current_user.id)
        .order_by(models.Project.created_at.desc())
        .all()
    )
    return projects


@router.post(
    "/",
    response_model=schemas.ProjectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    project = models.Project(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
        deadline=payload.deadline,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch(
    "/{project_id}",
    response_model=schemas.ProjectOut,
)
def update_project(
    project_id: int,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if payload.name is not None:
        project.name = payload.name.strip() or project.name

    if payload.description is not None:
        # allow clearing description via empty string
        desc = payload.description.strip()
        project.description = desc or None

    if payload.is_archived is not None:
        project.is_archived = payload.is_archived
        project.archived_at = datetime.utcnow() if payload.is_archived else None

    if payload.deadline is not None:
        project.deadline = payload.deadline

    db.commit()
    db.refresh(project)
    return project


@router.post(
    "/{project_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
)
def leave_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Owner cannot "leave" their own project – they should delete or transfer ownership.
    if project.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project owners cannot leave their own project.",
        )

    membership = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == project_id,
            models.ProjectParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        # nothing to do
        return

    db.delete(membership)
    db.commit()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user.id)

    # Fetch assets for this project
    assets = (
        db.query(models.Asset)
        .filter(models.Asset.project_id == project.id)
        .all()
    )

    # For each asset: delete its comments, then delete file + asset
    for asset in assets:
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
            file_path = os.path.join(UPLOAD_DIR, asset.file_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    # Ignore file delete errors in this MVP
                    pass

        # Delete asset record
        db.delete(asset)

    # Delete participants and invites via cascades (if configured on relationships)
    db.delete(project)
    db.commit()
    return


# ---------- PARTICIPANTS (list / remove) ----------


@router.get(
    "/{project_id}/participants",
    response_model=List[schemas.ProjectParticipantOut],
)
def list_participants(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    project = _get_project_or_404(db, project_id)
    _ensure_can_view_project(db, project, current_user.id)

    participants = (
        db.query(models.ProjectParticipant)
        .join(models.User, models.ProjectParticipant.user_id == models.User.id)
        .filter(models.ProjectParticipant.project_id == project_id)
        .order_by(models.ProjectParticipant.created_at.asc())
        .all()
    )
    return participants


@router.delete(
    "/{project_id}/participants/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_participant(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user.id)

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner cannot remove themselves as a participant",
        )

    membership = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == project_id,
            models.ProjectParticipant.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    db.delete(membership)
    db.commit()
    return


# ---------- INVITES (create by owner) ----------


@router.post(
    "/{project_id}/invites",
    response_model=schemas.ProjectInviteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_invite(
    project_id: int,
    payload: schemas.ProjectInviteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    project = _get_project_or_404(db, project_id)
    _ensure_owner(project, current_user.id)

    email = payload.invited_email.strip().lower()

    # Cannot invite self
    if email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself",
        )

    # Avoid duplicate pending invites
    existing_pending = (
        db.query(models.ProjectInvite)
        .filter(
            models.ProjectInvite.project_id == project_id,
            models.ProjectInvite.invited_email == email,
            models.ProjectInvite.status == "pending",
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already a pending invite for this email",
        )

    invited_user = (
        db.query(models.User)
        .filter(models.User.email == email)
        .first()
    )

    invite = models.ProjectInvite(
        project_id=project_id,
        invited_email=email,
        invited_user_id=invited_user.id if invited_user else None,
        invited_by_id=current_user.id,
        status="pending",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite

def _get_project_for_user_or_404(
    db: Session,
    user_id: int,
    project_id: int,
) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if project.owner_id == user_id:
        return project

    membership = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == project_id,
            models.ProjectParticipant.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project",
        )
    return project