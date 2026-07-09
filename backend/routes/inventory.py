from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.inventory import InventoryItemResponse
from backend.services.inventory_service import inventory_service

router = APIRouter()


@router.get("/inventory", response_model=list[InventoryItemResponse])
def list_inventory(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[InventoryItemResponse]:
    return [InventoryItemResponse(**item) for item in inventory_service.list_inventory(db)]
