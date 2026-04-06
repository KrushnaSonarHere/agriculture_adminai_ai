"""
routers/grievances.py  (complete replacement)
─────────────────────────────────────────────
POST /grievances/              → file new grievance
GET  /grievances/              → list all (admin, sorted by AI priority)
GET  /grievances/{id}          → single grievance
PUT  /grievances/{id}/status   → update status + SLA + notify farmer
POST /grievances/{id}/reply    → admin sends reply message → farmer notification
"""

import random, string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
import models, schemas
from routers.notifications import create_notification

router = APIRouter(prefix="/grievances", tags=["Grievances"])

# ── Helpers ───────────────────────────────────────────────────

def generate_grv_number():
    year   = datetime.now().year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"GRV-{year}-{suffix}"


def _sla_hours(priority: str) -> int:
    """SLA hours per priority tier (Maharashtra Lokshahi Din baseline)."""
    return {"high": 24, "medium": 72, "low": 168}.get(priority, 72)


def _priority_sort_key(g) -> int:
    """Lower = surfaces first. high-unresolved = 0, medium = 1, low = 2, resolved = 9."""
    if g.status == "Resolved":
        return 9
    return {"high": 0, "medium": 1, "low": 2}.get(g.priority or "medium", 1)


def _sla_remaining(g) -> dict:
    """Return hours remaining and whether breached."""
    if not g.filed_at:
        return {"hours_left": None, "breached": False}
    sla_h  = _sla_hours(g.priority or "medium")
    deadline = g.filed_at + timedelta(hours=sla_h)
    now_utc  = datetime.now(timezone.utc)
    # filed_at may be naive; treat as UTC
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    delta = deadline - now_utc
    hours_left = delta.total_seconds() / 3600
    return {"hours_left": round(hours_left, 1), "breached": hours_left < 0}


def _ai_summary(g) -> str:
    """Rule-based 2-line AI summary."""
    desc = (g.description or "")[:200]
    cat  = g.category or "Other"
    pri  = (g.priority or "medium").capitalize()
    lines = [
        f"[{pri} · {cat}] {desc[:100]}{'…' if len(desc) > 100 else ''}",
    ]
    # Suggest action
    action_map = {
        "Payment":  "Verify DBT record with PM-KISAN portal and check Aadhaar seed status.",
        "Document": "Re-run OCR verification and compare extracted vs submitted data.",
        "Scheme":   "Check application pipeline for bottlenecks and update status.",
        "Subsidy":  "Cross-check approved amount with bank credit statement.",
        "Technical": "Escalate to IT helpdesk; check session/OTP service status.",
    }
    lines.append(action_map.get(cat, "Review full complaint and coordinate with field officer."))
    return "\n".join(lines)


def _enrich(g) -> dict:
    """Add computed fields to a grievance ORM object."""
    sla = _sla_remaining(g)
    return {
        "id":              g.id,
        "grv_number":      g.grv_number,
        "farmer_name":     g.farmer_name,
        "farmer_id":       g.farmer_id,
        "category":        g.category,
        "title":           g.title,
        "description":     g.description,
        "priority":        g.priority,
        "status":          g.status,
        "assigned_to":     g.assigned_to,
        "resolution_note": g.resolution_note,
        "filed_at":        g.filed_at,
        "updated_at":      getattr(g, "updated_at", None),
        # AI-computed fields
        "ai_summary":      _ai_summary(g),
        "sla_hours_left":  sla["hours_left"],
        "sla_breached":    sla["breached"],
        "sla_total_hours": _sla_hours(g.priority or "medium"),
    }


# ── Pydantic helpers ─────────────────────────────────────────

class ReplyPayload(BaseModel):
    reply_text:  str
    assigned_to: Optional[str] = None
    new_status:  Optional[str] = None


class StatusPayload(BaseModel):
    status:          str
    assigned_to:     Optional[str] = None
    resolution_note: Optional[str] = None


# ── POST — File new grievance ────────────────────────────────
@router.post("/", response_model=schemas.GrievanceResponse, status_code=201)
def file_grievance(payload: schemas.GrievanceCreate, db: Session = Depends(get_db)):
    grv = models.Grievance(
        grv_number     = generate_grv_number(),
        farmer_name    = payload.farmer_name,
        farmer_id      = payload.farmer_id,
        category       = payload.category,
        title          = payload.title,
        description    = payload.description,
        priority       = payload.priority or "medium",
        related_app_id = payload.related_app_id,
        status         = "Filed",
        filed_at       = datetime.now(timezone.utc),
    )
    db.add(grv)
    db.commit()
    db.refresh(grv)

    # Notify all admins
    create_notification(
        db,
        user_id        = 0,
        role           = "admin",
        message        = (
            f"📢 New Grievance: {grv.grv_number} | "
            f"{grv.farmer_name} | {grv.category} | "
            f"Priority: {(grv.priority or 'medium').upper()}"
        ),
        application_id = grv.related_app_id,
    )
    return grv


# ── GET all grievances — AI-sorted ───────────────────────────
@router.get("/", response_model=List[dict])
def get_all_grievances(
    skip:  int = 0,
    limit: int = 200,
    db:    Session = Depends(get_db),
):
    all_g   = db.query(models.Grievance).offset(skip).limit(limit).all()
    sorted_g = sorted(all_g, key=_priority_sort_key)
    return [_enrich(g) for g in sorted_g]


# ── GET single grievance ─────────────────────────────────────
@router.get("/{grv_id}")
def get_grievance(grv_id: int, db: Session = Depends(get_db)):
    g = db.query(models.Grievance).filter(models.Grievance.id == grv_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grievance not found")
    return _enrich(g)


# ── PUT — Update status (JSON body) ─────────────────────────
@router.put("/{grv_id}/status")
def update_grievance_status(
    grv_id:  int,
    payload: StatusPayload,
    db:      Session = Depends(get_db),
):
    g = db.query(models.Grievance).filter(models.Grievance.id == grv_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grievance not found")

    valid = ["Filed", "Received", "Assigned", "Action", "Resolved"]
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")

    g.status          = payload.status
    if payload.assigned_to:
        g.assigned_to = payload.assigned_to
    if payload.resolution_note:
        g.resolution_note = payload.resolution_note
    db.commit()
    db.refresh(g)
    return _enrich(g)


# ── POST — Admin sends reply → farmer notification ───────────
@router.post("/{grv_id}/reply")
def admin_reply(
    grv_id:  int,
    payload: ReplyPayload,
    db:      Session = Depends(get_db),
):
    g = db.query(models.Grievance).filter(models.Grievance.id == grv_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grievance not found")

    # Update fields
    if payload.new_status:
        valid = ["Filed", "Received", "Assigned", "Action", "Resolved"]
        if payload.new_status not in valid:
            raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
        g.status = payload.new_status
    if payload.assigned_to:
        g.assigned_to = payload.assigned_to
    if payload.new_status == "Resolved":
        g.resolution_note = payload.reply_text

    db.commit()
    db.refresh(g)

    # Send notification to farmer
    farmer_user = (
        db.query(models.FarmerUser)
        .filter(models.FarmerUser.farmer_id == g.farmer_id)
        .first()
    )
    if farmer_user:
        icon = "✅" if g.status == "Resolved" else "📨"
        create_notification(
            db,
            user_id        = farmer_user.id,
            role           = "farmer",
            message        = (
                f"{icon} Update on {g.grv_number}: "
                f"{payload.reply_text[:200]}"
            ),
            application_id = g.related_app_id,
        )

    return {"ok": True, "grv_number": g.grv_number, "status": g.status}
