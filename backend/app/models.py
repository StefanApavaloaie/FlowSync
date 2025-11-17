from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Projects this user owns (project manager)
    projects = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    # Projects this user participates in (invited to / collaborators)
    project_memberships = relationship(
        "ProjectParticipant",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Optional: invites this user has received/sent (notifications)
    invites_received = relationship(
        "ProjectInvite",
        foreign_keys="ProjectInvite.invited_user_id",
        back_populates="invited_user",
    )
    invites_sent = relationship(
        "ProjectInvite",
        foreign_keys="ProjectInvite.invited_by_id",
        back_populates="invited_by",
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # archive support
    is_archived = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="projects")
    assets = relationship("Asset", back_populates="project")

    participants = relationship(
        "ProjectParticipant",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    invites = relationship(
        "ProjectInvite",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    # activity log
    activities = relationship(
        "Activity",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class ProjectParticipant(Base):
    """
    Many-to-many link between User and Project.

    Owner is still stored on Project.owner_id, this table is for additional members.
    """

    __tablename__ = "project_participants"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # 'member' (collaborator), etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="participants")
    user = relationship("User", back_populates="project_memberships")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # uploader
    file_path = Column(String, nullable=False)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="assets")
    comments = relationship("Comment", back_populates="asset")
    uploader = relationship("User")  # who uploaded this asset


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="comments")
    user = relationship("User")  # used so we can show author in API
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    # NEW: emoji reactions on this comment
    reactions = relationship(
        "CommentReaction",
        back_populates="comment",
        cascade="all, delete-orphan",
    )
    parent = relationship("Comment", remote_side=[id], backref="children")

class CommentReaction(Base):
    """
    Emoji reaction to a comment (👍, ❤️, 💡, etc.).
    One row per (comment, user, emoji).
    """

    __tablename__ = "comment_reactions"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    emoji = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    comment = relationship("Comment", back_populates="reactions")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "comment_id",
            "user_id",
            "emoji",
            name="uq_comment_reaction",
        ),
    )


class ProjectInvite(Base):
    """
    Invitation for a user (by email) to join a project.
    Works as our "notification" for now.
    """

    __tablename__ = "project_invites"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    invited_email = Column(String, index=True, nullable=False)
    invited_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    status = Column(
        String, default="pending"
    )  # 'pending', 'accepted', 'declined'
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="invites")
    invited_user = relationship(
        "User",
        foreign_keys=[invited_user_id],
        back_populates="invites_received",
    )
    invited_by = relationship(
        "User",
        foreign_keys=[invited_by_id],
        back_populates="invites_sent",
    )


class Activity(Base):
    """
    Simple activity log entry for a project.
    e.g. "X uploaded an asset", "Y commented", "Z reacted 👍 to a comment"
    """

    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    type = Column(String, nullable=False)  # 'asset_uploaded', 'comment_added', 'comment_reacted'
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="activities")
    user = relationship("User")
