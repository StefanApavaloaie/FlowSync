from datetime import datetime
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- USERS ----------


class UserOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- PROJECTS ----------


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = Field(None, max_length=2000)
    deadline: str | None = None
    model_config = ConfigDict(str_strip_whitespace=True)

class ProjectUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=2000)
    is_archived: bool | None = None
    deadline: str | None = None
    model_config = ConfigDict(str_strip_whitespace=True)

class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    is_archived: bool
    deadline: str | None
    class Config:
        from_attributes = True


# ---------- PARTICIPANTS ----------


class ProjectParticipantOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str
    user: UserOut

    class Config:
        from_attributes = True


# ---------- ASSETS ----------


class AssetOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    file_path: str
    version: int
    created_at: datetime
    status: str 

    class Config:
        from_attributes = True

class AssetStatusUpdate(BaseModel):
    status: str
# ---------- COMMENTS ----------


class CommentCreate(BaseModel):
    content: str = Field(..., max_length=3000)
    parent_id: int | None = None
    model_config = ConfigDict(str_strip_whitespace=True)

class CommentReactionCreate(BaseModel):
    emoji: str


class CommentReactionOut(BaseModel):
    id: int
    comment_id: int
    user_id: int
    emoji: str
    created_at: datetime

    class Config:
        from_attributes = True


class CommentOut(BaseModel):
    id: int
    asset_id: int
    user_id: int
    content: str
    parent_id: int | None = None
    created_at: datetime
    user: UserOut  # so frontend can show author name/email
    reactions: list[CommentReactionOut] = []  # NEW

    class Config:
        from_attributes = True


# ---------- INVITES / NOTIFICATIONS ----------


class ProjectInviteCreate(BaseModel):
    invited_email: EmailStr


class ProjectInviteOut(BaseModel):
    id: int
    project_id: int
    invited_email: EmailStr
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectInviteWithDetailsOut(BaseModel):
    """
    For notifications: includes project and inviting user.
    """

    id: int
    project_id: int
    invited_email: EmailStr
    status: str
    created_at: datetime
    project: ProjectOut
    invited_by: UserOut

    class Config:
        from_attributes = True


class ActivityOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    type: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


