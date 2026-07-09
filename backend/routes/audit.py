from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser, require_permissions
from backend.database.session import get_db_session
from backend.schemas.audit import AuditLogResponse

router = APIRouter()


@router.get("/audit", response_model=list[AuditLogResponse])
def list_audit_logs(
    _: CurrentUser = Depends(require_permissions("audit.read")),
    db: Session = Depends(get_db_session),
) -> list[AuditLogResponse]:
    return [AuditLogResponse(**row) for row in audit_service.list_logs(db)]
