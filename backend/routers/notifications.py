"""
routers/notifications.py
────────────────────────
GET  /notifications              → fetch notifications for current user
POST /notifications/             → create a notification (internal use)
PATCH /notifications/read        → mark ALL unread as read for a user
PATCH /notifications/{id}/read   → mark single notification as read
DELETE /notifications/clear      → clear all read notifications for a user
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import models

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── Pydantic schemas ─────────────────────────────────────────

class NotificationOut(BaseModel):
    id:             int
    user_id:        int
    role:           str
    message:        str
    application_id: Optional[int] = None
    is_read:        bool
    created_at:     datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    user_id:        int
    role:           str        # "farmer" / "admin"
    message:        str
    application_id: Optional[int] = None


class BulkReadPayload(BaseModel):
    user_id: int
    role:    str   # "farmer" / "admin"


# ── Internal helper ──────────────────────────────────────────

def create_notification(db: Session, user_id: int, role: str, message: str, application_id: int = None):
    """Create a notification record. Called internally by other routers."""
    notif = models.Notification(
        user_id        = user_id,
        role           = role,
        message        = message,
        application_id = application_id,
        is_read        = False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


# ── GET — Fetch notifications for a user ─────────────────────
@router.get("/", response_model=List[NotificationOut])
def get_notifications(
    user_id:     int = Query(...,  description="User ID (0 for admin broadcast)"),
    role:        str = Query(...,  description="'farmer' or 'admin'"),
    unread_only: bool = Query(False, description="Return only unread notifications"),
    limit:       int = Query(50,   description="Max results"),
    db: Session = Depends(get_db),
):
    """
    Fetch notifications for a specific user.
    - Farmers: query by their user_id and role='farmer'
    - Admins:  query by role='admin' (user_id=0 sentinel — all admins share same pool)
    """
    q = db.query(models.Notification)

    if role == "admin":
        # All admin notifications (user_id=0 sentinel)
        q = q.filter(models.Notification.role == "admin")
    else:
        q = q.filter(
            models.Notification.role    == "farmer",
            models.Notification.user_id == user_id,
        )

    if unread_only:
        q = q.filter(models.Notification.is_read == False)

    notifications = (
        q.order_by(models.Notification.created_at.desc())
         .limit(limit)
         .all()
    )
    return notifications


# ── POST — Create notification (internal / admin use) ────────
@router.post("/", response_model=NotificationOut, status_code=201)
def post_notification(payload: NotificationCreate, db: Session = Depends(get_db)):
    """Manually create a notification. Mostly used internally."""
    return create_notification(
        db,
        user_id        = payload.user_id,
        role           = payload.role,
        message        = payload.message,
        application_id = payload.application_id,
    )


# ── PATCH — Mark ALL notifications read for a user ───────────
@router.patch("/read", status_code=200)
def mark_all_read(payload: BulkReadPayload, db: Session = Depends(get_db)):
    """Mark all unread notifications as read for a given user/role."""
    q = db.query(models.Notification).filter(
        models.Notification.is_read == False
    )
    if payload.role == "admin":
        q = q.filter(models.Notification.role == "admin")
    else:
        q = q.filter(
            models.Notification.role    == "farmer",
            models.Notification.user_id == payload.user_id,
        )
    updated = q.update({"is_read": True})
    db.commit()
    return {"marked_read": updated}


# ── PATCH — Mark single notification read ────────────────────
@router.patch("/{notif_id}/read", response_model=NotificationOut)
def mark_one_read(notif_id: int, db: Session = Depends(get_db)):
    """Mark a single notification as read."""
    notif = db.query(models.Notification).filter(models.Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


# ── GET — Unread count ────────────────────────────────────────
@router.get("/count", response_model=dict)
def get_unread_count(
    user_id: int = Query(...),
    role:    str = Query(...),
    db: Session = Depends(get_db),
):
    """Return just the unread notification count (for badge)."""
    q = db.query(models.Notification).filter(models.Notification.is_read == False)
    if role == "admin":
        q = q.filter(models.Notification.role == "admin")
    else:
        q = q.filter(
            models.Notification.role    == "farmer",
            models.Notification.user_id == user_id,
        )
    return {"count": q.count()}


# ── DELETE — Clear read notifications ────────────────────────
@router.delete("/clear", status_code=200)
def clear_read_notifications(
    user_id: int = Query(...),
    role:    str = Query(...),
    db: Session = Depends(get_db),
):
    """Delete all already-read notifications for a user."""
    q = db.query(models.Notification).filter(models.Notification.is_read == True)
    if role == "admin":
        q = q.filter(models.Notification.role == "admin")
    else:
        q = q.filter(
            models.Notification.role    == "farmer",
            models.Notification.user_id == user_id,
        )
    deleted = q.delete()
    db.commit()
    return {"deleted": deleted}
