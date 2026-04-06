"""
routers/agribot.py
──────────────────────────────────────────────────────────────
POST /agribot/chat  → Farmer chatbot with rule-based NLP + scheme DB lookup

The bot understands questions about:
- Application status ("where is my application?")
- Scheme eligibility ("am I eligible for PM Kisan?")
- Payment issues ("my payment didn't come")
- Document requirements ("what documents do I need?")
- Grievance filing help
- General agriculture helplines

Falls back to GPT-style keyword matching so it works with ZERO external APIs.
"""

import re, os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
import models

router = APIRouter(prefix="/agribot", tags=["AgriBot"])


# ── Pydantic schemas ─────────────────────────────────────────
class ChatMessage(BaseModel):
    message:   str
    user_id:   Optional[int] = None
    language:  Optional[str] = "en"   # en | hi | mr


class BotResponse(BaseModel):
    reply:     str
    intent:    str
    chips:     List[str] = []       # quick-reply chips
    link:      Optional[str] = None  # optional CTA link
    link_label: Optional[str] = None


# ── Intent patterns ──────────────────────────────────────────
INTENTS = {
    "application_status": [
        "application", "status", "my application", "where is", "track", "pending",
        "approved", "rejected", "आवेदन", "स्थिति", "अर्ज",
    ],
    "payment_issue": [
        "payment", "money", "installment", "not received", "credit", "bank",
        "disburs", "pm kisan", "पैसे", "भुगतान", "किस्त", "रक्कम",
    ],
    "scheme_eligibility": [
        "eligible", "eligibility", "qualify", "which scheme", "what scheme",
        "can i apply", "सब्सिडी", "योजना", "पात्र",
    ],
    "document_help": [
        "document", "upload", "what documents", "required documents", "7/12",
        "aadhaar", "satbara", "bank passbook", "कागजात", "दस्तावेज़",
    ],
    "grievance_help": [
        "complaint", "grievance", "problem", "issue", "officer", "bribe",
        "not working", "शिकायत", "समस्या",
    ],
    "scheme_list": [
        "schemes", "all schemes", "available scheme", "list scheme",
        "योजनाएं", "सभी योजनाएं",
    ],
    "insurance": [
        "insurance", "fasal bima", "crop loss", "damage", "claim",
        "बीमा", "फसल बीमा",
    ],
    "subsidy": [
        "subsidy", "drip", "irrigation", "equipment", "tractor",
        "सब्सिडी", "अनुदान",
    ],
    "helpline": [
        "helpline", "phone", "number", "call", "contact", "help",
        "हेल्पलाइन", "फ़ोन",
    ],
    "greeting": [
        "hello", "hi", "hey", "namaste", "namaskar", "good morning",
        "नमस्ते", "नमस्कार", "हैलो",
    ],
    "thanks": [
        "thank", "thanks", "dhanyawad", "shukriya", "धन्यवाद", "शुक्रिया",
    ],
}

def detect_intent(text: str) -> str:
    text_lower = text.lower()
    scores = {intent: 0 for intent in INTENTS}
    for intent, keywords in INTENTS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[intent] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "unknown"


# ── Responses per intent ─────────────────────────────────────
def get_bot_reply(intent: str, user_id: int | None, db: Session, original_msg: str) -> BotResponse:

    if intent == "greeting":
        return BotResponse(
            intent="greeting",
            reply="🙏 Namaste! I'm AgriBot, your KisanSetu assistant.\n\nI can help you with:\n• Checking your application status\n• Finding eligible schemes\n• Document requirements\n• Payment issues\n• Filing grievances\n\nWhat can I help you with today?",
            chips=["Check my applications", "Which schemes am I eligible for?", "Payment not received", "What documents do I need?"],
        )

    if intent == "thanks":
        return BotResponse(
            intent="thanks",
            reply="🙏 You're welcome! If you need anything else, I'm always here.\n\nHave a great farming season! 🌾",
            chips=["Check application status", "File a complaint", "View schemes"],
        )

    if intent == "application_status":
        apps = []
        if user_id:
            try:
                apps = db.query(models.Application).filter(
                    models.Application.user_id == user_id
                ).order_by(models.Application.applied_at.desc()).limit(3).all()
            except Exception:
                pass

        if not apps:
            return BotResponse(
                intent="application_status",
                reply="📋 I couldn't find any applications linked to your account yet.\n\nYou can apply for a scheme from the Schemes page — I'll track it for you!",
                chips=["Browse Schemes", "Apply Now"],
                link="/schemes",
                link_label="Browse Schemes →",
            )

        lines = ["📋 Here are your recent applications:\n"]
        status_icons = {"Approved": "✅", "Pending": "⏳", "Processing": "🔄",
                       "Rejected": "❌", "Under Review": "📋"}
        for a in apps:
            icon = status_icons.get(a.status, "•")
            scheme = getattr(a.scheme, 'Scheme_Name', None) or a.scheme_name or "—"
            lines.append(f"{icon} **{scheme}**\nStatus: {a.status}\nApp#: {a.app_number or '—'}\n")

        return BotResponse(
            intent="application_status",
            reply="\n".join(lines),
            chips=["View all applications", "Track in detail", "File a complaint"],
            link="/applications",
            link_label="View All Applications →",
        )

    if intent == "payment_issue":
        return BotResponse(
            intent="payment_issue",
            reply="💰 **Payment not received?** Here's what to check:\n\n1. ✅ Is your Aadhaar linked to your bank account?\n2. ✅ Is your bank account active (not dormant)?\n3. ✅ Is your name on PM Kisan beneficiary list?\n4. ✅ Check status at pmkisan.gov.in\n\n📞 PM Kisan Helpline: **155261**\n\nIf still unresolved, file a grievance — I can help with that too.",
            chips=["File a grievance", "Check PM Kisan status", "What documents needed?"],
            link="/grievance",
            link_label="File Complaint →",
        )

    if intent == "scheme_eligibility":
        schemes = []
        try:
            schemes = db.query(models.Scheme).limit(5).all()
        except Exception:
            pass

        scheme_lines = ""
        if schemes:
            scheme_lines = "\n\nAvailable schemes:\n" + "\n".join(
                f"• {s.Scheme_Name}" for s in schemes
            )

        return BotResponse(
            intent="scheme_eligibility",
            reply=f"🌾 **Scheme Eligibility**\n\nMost schemes require:\n• Small/Marginal farmer (land < 2 hectares)\n• Valid Aadhaar card\n• Active bank account\n• Land records (7/12 extract)\n\nBrowse all available government schemes and apply directly.{scheme_lines}",
            chips=["Browse all schemes", "Apply for PM Kisan", "Check my documents"],
            link="/schemes",
            link_label="View All Schemes →",
        )

    if intent == "document_help":
        return BotResponse(
            intent="document_help",
            reply="📄 **Required Documents**\n\nFor most scheme applications you'll need:\n\n🔹 **Identity**: Aadhaar Card\n🔹 **Land**: 7/12 Extract (Satbara Utara)\n🔹 **Land**: 8-A Certificate\n🔹 **Bank**: Passbook (Aadhaar-linked)\n🔹 **Photo**: Recent passport photo\n🔹 **Income**: Income certificate (for some schemes)\n\nYou can upload all documents to your **Document Vault** — they'll be auto-filled next time you apply!",
            chips=["Go to My Documents", "Upload documents", "Start an application"],
            link="/documents",
            link_label="Open Document Vault →",
        )

    if intent == "grievance_help":
        return BotResponse(
            intent="grievance_help",
            reply="📢 **Filing a Grievance**\n\nYou can file a complaint about:\n• Payment delays\n• Document errors\n• Scheme rejection\n• Officer misconduct\n• Any other issue\n\n**New!** 🎙️ You can now record your complaint in **Marathi or Hindi** — no typing needed! Our AI will categorise and route it automatically.",
            chips=["File voice complaint", "Type a complaint", "Check complaint status"],
            link="/grievance",
            link_label="Go to Grievance Portal →",
        )

    if intent == "scheme_list":
        try:
            schemes = db.query(models.Scheme).limit(6).all()
            if schemes:
                lines = ["🌾 **Available Government Schemes:**\n"]
                for s in schemes:
                    lines.append(f"• {s.Scheme_Name} ({s.Department or 'Govt'})")
                lines.append("\nTap any scheme to apply directly.")
                return BotResponse(
                    intent="scheme_list",
                    reply="\n".join(lines),
                    chips=["Apply for a scheme", "Check eligibility"],
                    link="/schemes",
                    link_label="Browse All Schemes →",
                )
        except Exception:
            pass
        return BotResponse(
            intent="scheme_list",
            reply="🌾 Browse all available government schemes on the Schemes page. You can filter by category and apply directly.",
            chips=["Browse schemes"],
            link="/schemes",
            link_label="Browse Schemes →",
        )

    if intent == "insurance":
        return BotResponse(
            intent="insurance",
            reply="🛡️ **Pradhan Mantri Fasal Bima Yojana (PMFBY)**\n\nCrop insurance covers:\n• Natural disasters (flood, drought, cyclone)\n• Pest & disease damage\n• Post-harvest losses\n\n**To claim:**\n1. Report crop loss within 72 hours\n2. Get crop loss certificate from Patwari\n3. Submit claim with photos\n\n📞 PMFBY Helpline: **1800-200-7710**",
            chips=["Apply for insurance", "File crop loss claim", "Check claim status"],
            link="/insurance",
            link_label="Go to Insurance →",
        )

    if intent == "subsidy":
        return BotResponse(
            intent="subsidy",
            reply="💰 **Subsidy Schemes Available:**\n\n🔹 **Drip Irrigation** — Up to 55% subsidy\n🔹 **Farm Equipment** — Agricultural Mechanization Sub-Campaign\n🔹 **Solar Pump** — PM-KUSUM scheme\n🔹 **Seed Distribution** — NFSM (wheat, oilseeds, cotton)\n\nApply through the Subsidies section or use the Schemes page.",
            chips=["View subsidy schemes", "Apply for drip irrigation", "Check eligibility"],
            link="/subsidies",
            link_label="View Subsidies →",
        )

    if intent == "helpline":
        return BotResponse(
            intent="helpline",
            reply="📞 **Important Helplines:**\n\n🌾 KisanSetu: **1800-180-1551** (Free)\n💰 PM Kisan: **155261**\n🛡️ Fasal Bima: **1800-200-7710**\n💧 PM Krishi Sinchai: **1800-180-1551**\n🚨 Anti-Corruption: **1064**\n🏛️ District Collector: Visit collectorate\n\nAll helplines are **toll-free** and available Mon–Sat, 9am–6pm.",
            chips=["File a grievance", "Check application status"],
        )

    # Unknown / fallback
    return BotResponse(
        intent="unknown",
        reply="🤔 I'm not sure I understood that. Here are some things I can help with:",
        chips=["Check my applications", "Payment not received", "Which schemes am I eligible for?", "What documents do I need?", "File a complaint", "Helpline numbers"],
    )


# ── POST /agribot/chat ───────────────────────────────────────
@router.post("/chat", response_model=BotResponse)
def chat(msg: ChatMessage, db: Session = Depends(get_db)):
    if not msg.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    intent  = detect_intent(msg.message)
    user_id = msg.user_id  # may be None for unauthenticated
    return get_bot_reply(intent, user_id, db, msg.message)
