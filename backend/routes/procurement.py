from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser, require_permissions
from backend.database.session import get_db_session
from backend.schemas.orders import ProcurementGenerateRequest, ProcurementOrderResponse
from backend.services.order_service import order_service

router = APIRouter()


@router.post("/procurement", response_model=ProcurementOrderResponse)
def generate_procurement(
    payload: ProcurementGenerateRequest,
    current_user: CurrentUser = Depends(require_permissions("purchase_order.generate")),
    db: Session = Depends(get_db_session),
) -> ProcurementOrderResponse:
    created = order_service.generate_procurement(db, current_user, payload.medicine_id, payload.quantity)
    audit_id = audit_service.log_event(
        db,
        current_user=current_user,
        agent="Procurement Agent",
        tool="purchase_order.generate",
        action="Purchase Request Generated",
        entity_type="Order",
        entity_id=created["id"],
        status="completed",
        detail=f"{created['medicine_name']} via {created['supplier_name']}",
    )
    created["trace"] = {
        **(created.get("trace") or {}),
        "audit_id": audit_id,
    }
    db.commit()
    return ProcurementOrderResponse(**created)
