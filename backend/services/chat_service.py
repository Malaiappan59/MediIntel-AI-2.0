import secrets
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.agents.workspace import AIConfigurationError, AIExecutionError, workspace_agent_service
from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser
from backend.models.entities import ChatHistory, ChatSession
from backend.schemas.chat import ChatRequest
from backend.services.erp_queries import list_chat_history
from backend.utils.redaction import build_audit_safe_prompt_detail


class ChatService:
    def _get_or_create_session(self, db: Session, current_user: CurrentUser, goal: str) -> ChatSession:
        session = db.scalar(
            select(ChatSession)
            .where(ChatSession.username == current_user.username, ChatSession.status == "active")
            .order_by(ChatSession.updated_at.desc())
        )
        now = datetime.now(UTC)
        if session is None:
            session = ChatSession(
                session_code=f"CHAT-SESSION-{secrets.token_hex(5).upper()}",
                username=current_user.username,
                goal=goal,
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(session)
            db.flush()
        else:
            session.goal = goal
            session.updated_at = now
        return session

    def _build_execution(self, reply: dict) -> dict:
        stages = []
        ordered_stages = [
            ("master", "Master Agent", "Mission coordination"),
            ("inventory", "Inventory Agent", "Inventory and workflow analysis"),
            ("forecast", "Forecast Agent", "Forecast and signal analysis"),
            ("recommendation", "Recommendation Agent", "Recommendation and validation"),
            ("procurement", "Procurement Agent", "Execution and handoff"),
        ]
        used = set(reply["agents_used"])

        for stage_id, title, subtitle in ordered_stages:
            if title == "Master Agent":
                status = "completed"
                summary = reply["summary"]["headline"]
            elif title in used:
                contribution = next((item for item in reply["contributions"] if item["agent"] == title), None)
                status = contribution["status"] if contribution else "completed"
                summary = contribution["summary"] if contribution else "Completed."
            else:
                status = "idle"
                summary = "Not required for this request."

            stages.append(
                {
                    "id": stage_id,
                    "title": title,
                    "subtitle": subtitle,
                    "status": status,
                    "summary": summary,
                }
            )

        timeline = [
            {
                "id": f"TL-{index + 1:03d}",
                "title": contribution["agent"],
                "detail": contribution["detail"],
                "status": contribution["status"],
                "timestamp": reply["created_at"],
            }
            for index, contribution in enumerate(reply["contributions"])
        ]
        return {
            "id": reply["id"],
            "goal": reply["summary"]["headline"],
            "launched_at": reply["created_at"],
            "confidence_score": float(reply["confidence"]),
            "reasoning": reply["reasoning"],
            "next_action": reply["actions"][0]["label"] if reply["actions"] else "Review the latest response.",
            "stages": stages,
            "timeline": timeline,
        }

    async def respond(self, db: Session, current_user: CurrentUser, payload: ChatRequest, ip_address: str | None = None) -> dict:
        session = self._get_or_create_session(db, current_user, "Predict. Prevent. Procure.")
        now = datetime.now(UTC)
        prompt_detail = build_audit_safe_prompt_detail(payload.message)
        user_message_code = f"CHAT-{int(now.timestamp() * 1000)}-USER"
        db.add(
            ChatHistory(
                message_code=user_message_code,
                session_code=session.session_code,
                username=current_user.username,
                role="user",
                content=payload.message,
                confidence=None,
                reasoning=None,
                structured_payload=None,
                created_at=now,
            )
        )
        db.flush()

        started_at = time.perf_counter()
        try:
            reply_model, _, execution_time_ms = await workspace_agent_service.run_workspace_query(current_user, payload.message)
        except Exception as exc:  # pragma: no cover - protects external SDK/runtime failures
            if isinstance(exc, (AIConfigurationError, AIExecutionError)):
                raise
            raise AIExecutionError("Live AI runtime encountered an unexpected error.") from exc

        reply_dict = reply_model.model_dump(mode="json")
        audit_id = audit_service.log_event(
            db,
            current_user=current_user,
            agent="Master Agent",
            tool="workspace.chat",
            action="AI Workspace Query",
            entity_type="ChatSession",
            entity_id=session.session_code,
            status="completed",
            detail=prompt_detail,
            ip_address=ip_address,
            execution_time_ms=execution_time_ms or int((time.perf_counter() - started_at) * 1000),
        )
        reply_dict["audit_id"] = audit_id
        reply_dict["execution"] = self._build_execution(reply_dict)
        reply_dict["summary"]["metrics"] = reply_dict["summary"].get("metrics") or []

        assistant_code = f"CHAT-{int(datetime.now(UTC).timestamp() * 1000)}-ASSISTANT"
        db.add(
            ChatHistory(
                message_code=assistant_code,
                session_code=session.session_code,
                username=current_user.username,
                role="assistant",
                content=reply_dict["summary"]["narrative"],
                confidence=reply_dict["confidence"],
                reasoning=reply_dict["reasoning"],
                structured_payload=reply_dict,
                created_at=datetime.now(UTC),
            )
        )
        session.updated_at = datetime.now(UTC)
        db.commit()

        history = list_chat_history(db, username=current_user.username, limit=50)
        return {
            "reply": reply_dict,
            "history": history,
        }


chat_service = ChatService()
