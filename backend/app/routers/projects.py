import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/projects", tags=["projects"])

UPLOAD_DIR = "uploads"


def _require_project_owner(
    db: Session,
    project_id: int,
    user_id: int,
) -> models.Project:
    """
    Ensure the project exists and the current user is the owner.
    """
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    if project.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can perform this action",
        )
    return project


@router.get("/", response_model=List[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    For now, return only projects where the user is the owner.
    (Later we can add 'projects I collaborate on' separately.)
    """
    projects = (
        db.query(models.Project)
        .filter(models.Project.owner_id == current_user.id)
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
    """
    Create a project; the creator is the owner for that project.
    """
    project = models.Project(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Only the owner can delete the project.
    This deletes all assets, their comments, and associated files.
    """
    project = _require_project_owner(db, project_id, current_user.id)

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

    # Delete project participants as well (relationship has cascade, but be explicit)
    db.query(models.ProjectParticipant).filter(
        models.ProjectParticipant.project_id == project.id
    ).delete()

    # Finally, delete the project itself
    db.delete(project)
    db.commit()
    return


# ---------- COLLABORATORS MANAGEMENT (OWNER ONLY) ----------


@router.get(
    "/{project_id}/participants",
    response_model=List[schemas.ProjectParticipantOut],
)
def list_participants(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    """
    Owner can list all collaborators on the project.
    (Owner is NOT stored here; this table is collaborators / members.)
    """
    project = _require_project_owner(db, project_id, current_user.id)

    participants = (
        db.query(models.ProjectParticipant)
        .filter(models.ProjectParticipant.project_id == project.id)
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
    """
    Owner removes a collaborator from the project.
    Owner cannot remove themselves here.
    """
    project = _require_project_owner(db, project_id, current_user.id)

    if user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner cannot be removed from their own project.",
        )

    participation = (
        db.query(models.ProjectParticipant)
        .filter(
            models.ProjectParticipant.project_id == project.id,
            models.ProjectParticipant.user_id == user_id,
        )
        .first()
    )
    if not participation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found on this project.",
        )

    db.delete(participation)
    db.commit()
    return
