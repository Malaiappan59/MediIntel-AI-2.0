import secrets
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser
from backend.models.entities import ChatSession
from backend.schemas.master_agent import MasterAgentLaunchRequest
from backend.utils.redaction import build_audit_safe_prompt_detail


class MasterAgentService:
    def launch(self, db: Session, current_user: CurrentUser, payload: MasterAgentLaunchRequest) -> dict:
        session = db.scalar(
            select(ChatSession)
            .where(ChatSession.username == current_user.username)
            .order_by(ChatSession.updated_at.desc())
        )
        now = datetime.now(UTC)

        if session is None or session.status != "active":
            session = ChatSession(
                session_code=f"CHAT-SESSION-{secrets.token_hex(5).upper()}",
                username=current_user.username,
                goal=payload.goal,
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(session)
        else:
            session.goal = payload.goal
            session.updated_at = now

        audit_service.log_event(
            db,
            current_user=current_user,
            agent="Master Agent",
            tool="workspace.launch",
            action="AI Workspace Launch",
            entity_type="ChatSession",
            entity_id=session.session_code,
            status="completed",
            detail=build_audit_safe_prompt_detail(payload.goal),
        )
        db.commit()
        return {
            "id": session.session_code,
            "goal": payload.goal,
            "launched_at": now.isoformat(),
            "confidence_score": 0,
            "reasoning": "Workspace session initialized. Live agent execution begins after the first model-backed user prompt.",
            "next_action": "Submit a request to MediIntel AI.",
            "stages": [
                {
                    "id": "master",
                    "title": "Master Agent",
                    "subtitle": "Mission coordination",
                    "status": "completed",
                    "summary": "Goal accepted and execution context prepared.",
                },
                {
                    "id": "inventory",
                    "title": "Inventory Agent",
                    "subtitle": "Inventory and workflow analysis",
                    "status": "idle",
                    "summary": "Waiting for task routing.",
                },
                {
                    "id": "forecast",
                    "title": "Forecast Agent",
                    "subtitle": "Forecast and signal analysis",
                    "status": "idle",
                    "summary": "Waiting for task routing.",
                },
                {
                    "id": "recommendation",
                    "title": "Recommendation Agent",
                    "subtitle": "Recommendation and validation",
                    "status": "idle",
                    "summary": "Waiting for task routing.",
                },
                {
                    "id": "procurement",
                    "title": "Procurement Agent",
                    "subtitle": "Execution and handoff",
                    "status": "idle",
                    "summary": "Waiting for task routing.",
                },
            ],
            "timeline": [
                {
                    "id": "TL-001",
                    "title": "Mission initialized",
                    "detail": f"{current_user.full_name} started a MediIntel AI workspace session.",
                    "status": "completed",
                    "timestamp": now.isoformat(),
                }
            ],
        }


master_agent_service = MasterAgentService()
