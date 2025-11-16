from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_db, get_current_user_from_header

router = APIRouter(prefix="/projects", tags=["activity"])


def _assert_can_access_project(
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


@router.get(
    "/{project_id}/activity",
    response_model=List[schemas.ActivityOut],
)
def list_activity(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_header),
):
    _ = _assert_can_access_project(db, current_user.id, project_id)

    activities = (
        db.query(models.Activity)
        .filter(models.Activity.project_id == project_id)
        .order_by(models.Activity.created_at.desc())
        .limit(50)
        .all()
    )
    return activities
