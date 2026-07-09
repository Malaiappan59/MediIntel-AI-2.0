from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser, get_current_user, require_permissions
from backend.database.session import get_db_session
from backend.schemas.api_registry import ApiCreateRequest, ApiResponse
from backend.services.api_registry_service import api_registry_service

router = APIRouter()


@router.get("/apis", response_model=list[ApiResponse])
def list_apis(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[ApiResponse]:
    return [ApiResponse(**record) for record in api_registry_service.list_apis(db)]


@router.post("/apis", response_model=ApiResponse)
def create_api(
    payload: ApiCreateRequest,
    current_user: CurrentUser = Depends(require_permissions("api.manage")),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    created = api_registry_service.create_api(db, payload)
    audit_service.log_event(
        db,
        current_user=current_user,
        agent="API Registry",
        tool="api.manage",
        action="API Registered",
        entity_type="API",
        entity_id=created["id"],
        status="completed",
        detail=created["name"],
    )
    db.commit()
    return ApiResponse(**created)


@router.delete("/apis/{api_id}")
def delete_api(
    api_id: str,
    current_user: CurrentUser = Depends(require_permissions("api.manage")),
    db: Session = Depends(get_db_session),
) -> dict:
    deleted = api_registry_service.delete_api(db, api_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API definition not found")
    audit_service.log_event(
        db,
        current_user=current_user,
        agent="API Registry",
        tool="api.manage",
        action="API Deleted",
        entity_type="API",
        entity_id=api_id,
        status="completed",
        detail=api_id,
    )
    db.commit()
    return {"message": "API definition deleted successfully."}
