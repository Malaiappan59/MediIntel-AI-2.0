from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user, require_permissions
from backend.database.session import get_db_session
from backend.schemas.orders import ProcurementOrderCreate, ProcurementOrderResponse
from backend.services.order_service import order_service

router = APIRouter()


@router.get("/orders", response_model=list[ProcurementOrderResponse])
def list_orders(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[ProcurementOrderResponse]:
    return [ProcurementOrderResponse(**order) for order in order_service.list_orders(db)]


@router.post("/orders", response_model=ProcurementOrderResponse)
def create_order(
    payload: ProcurementOrderCreate,
    current_user: CurrentUser = Depends(require_permissions("purchase_order.generate")),
    db: Session = Depends(get_db_session),
) -> ProcurementOrderResponse:
    payload.requested_by = current_user.full_name
    return ProcurementOrderResponse(**order_service.create_order(db, payload))
