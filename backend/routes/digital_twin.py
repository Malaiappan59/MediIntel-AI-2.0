from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.digital_twin import DigitalTwinResponse
from backend.services.erp_queries import get_hospital_profile, list_alerts, list_inventory_items, list_orders

router = APIRouter()


@router.get("/digital-twin", response_model=DigitalTwinResponse)
def get_digital_twin(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> DigitalTwinResponse:
    try:
        hospital = get_hospital_profile(db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    inventory = list_inventory_items(db)
    alerts = list_alerts(db, only_open=True)
    orders = list_orders(db)
    critical_medicines = len([item for item in inventory if item["status"] == "critical"])
    predicted_shortages = len([item for item in inventory if item["shortage_risk"] >= 78])
    pending_approvals = len([order for order in orders if order["status"] in {"pending-approval", "modified"}])
    inventory_health = max(54.0, round(98 - critical_medicines * 1.5 - predicted_shortages * 0.12, 1))
    return DigitalTwinResponse(
        hospital=hospital,
        live_state={
            "inventory_health": inventory_health,
            "critical_medicines": critical_medicines,
            "predicted_shortages": predicted_shortages,
            "pending_approvals": pending_approvals,
            "open_alerts": len(alerts),
        },
    )
