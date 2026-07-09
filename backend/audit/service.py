from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser
from backend.models.entities import AuditLog
from backend.services.erp_queries import list_audit_logs


class AuditService:
    def list_logs(self, db: Session, limit: int = 100) -> list[dict]:
        return list_audit_logs(db, limit=limit)

    def log_event(
        self,
        db: Session,
        *,
        current_user: CurrentUser,
        agent: str,
        tool: str,
        action: str,
        entity_type: str,
        entity_id: str,
        status: str,
        detail: str,
        ip_address: str | None = None,
        execution_time_ms: int | None = None,
    ) -> str:
        next_id = (db.scalar(select(func.count()).select_from(AuditLog)) or 0) + 1
        event_code = f"AUD-{next_id:04d}"
        db.add(
            AuditLog(
                event_code=event_code,
                actor=current_user.full_name,
                user_role=current_user.role,
                agent=agent,
                tool=tool,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                status=status,
                execution_time_ms=execution_time_ms,
                ip_address=ip_address,
                event_metadata={"detail": detail},
                created_at=datetime.now(UTC),
            )
        )
        db.flush()
        return event_code


audit_service = AuditService()
