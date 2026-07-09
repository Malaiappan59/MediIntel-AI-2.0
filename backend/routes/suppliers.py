from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.suppliers import SupplierResponse
from backend.services.erp_queries import list_suppliers

router = APIRouter()


@router.get("/suppliers", response_model=list[SupplierResponse])
def get_suppliers(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[SupplierResponse]:
    return [SupplierResponse(**supplier) for supplier in list_suppliers(db)]
