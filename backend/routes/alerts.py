from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.alerts import AlertResolveRequest, AlertResponse
from backend.services.alert_service import alert_service

router = APIRouter()


@router.get("/alerts", response_model=list[AlertResponse])
def list_alerts(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[AlertResponse]:
    return [AlertResponse(**alert) for alert in alert_service.list_alerts(db)]


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
def resolve_alert(
    alert_id: str,
    _: AlertResolveRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> AlertResponse:
    updated = alert_service.resolve_alert(db, alert_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    audit_service.log_event(
        db,
        current_user=current_user,
        agent="Alert Monitor",
        tool="alerts.resolve",
        action="Alert Resolved",
        entity_type="Alert",
        entity_id=alert_id,
        status="completed",
        detail=updated["title"],
    )
    db.commit()
    return AlertResponse(**updated)
