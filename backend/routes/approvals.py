from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser, require_permissions
from backend.database.session import get_db_session
from backend.schemas.approvals import ApprovalActionRequest, ApprovalQueueResponse
from backend.services.order_service import order_service

router = APIRouter()


@router.get("/approvals", response_model=list[ApprovalQueueResponse])
def list_approvals(
    _: CurrentUser = Depends(require_permissions("approval.approve")),
    db: Session = Depends(get_db_session),
) -> list[ApprovalQueueResponse]:
    orders = [
        order
        for order in order_service.list_orders(db)
        if order["status"] in {"pending-approval", "modified"}
    ]
    return [ApprovalQueueResponse(**order) for order in orders]


@router.post("/approve", response_model=ApprovalQueueResponse)
def approve_order(
    payload: ApprovalActionRequest,
    current_user: CurrentUser = Depends(require_permissions("approval.approve")),
    db: Session = Depends(get_db_session),
) -> ApprovalQueueResponse:
    updated = order_service.update_order_status(db, payload.order_id, "approved", current_user)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    audit_id = audit_service.log_event(
        db,
        current_user=current_user,
        agent="Procurement Agent",
        tool="approval.approve",
        action="Approval Granted",
        entity_type="Order",
        entity_id=payload.order_id,
        status="completed",
        detail=updated["medicine_name"],
    )
    updated["trace"] = {
        **(updated.get("trace") or {}),
        "audit_id": audit_id,
    }
    db.commit()
    return ApprovalQueueResponse(**updated)


@router.post("/reject", response_model=ApprovalQueueResponse)
def reject_order(
    payload: ApprovalActionRequest,
    current_user: CurrentUser = Depends(require_permissions("approval.reject")),
    db: Session = Depends(get_db_session),
) -> ApprovalQueueResponse:
    updated = order_service.update_order_status(db, payload.order_id, "rejected", current_user)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    audit_id = audit_service.log_event(
        db,
        current_user=current_user,
        agent="Procurement Agent",
        tool="approval.reject",
        action="Approval Rejected",
        entity_type="Order",
        entity_id=payload.order_id,
        status="completed",
        detail=updated["medicine_name"],
    )
    updated["trace"] = {
        **(updated.get("trace") or {}),
        "audit_id": audit_id,
    }
    db.commit()
    return ApprovalQueueResponse(**updated)


@router.post("/modify", response_model=ApprovalQueueResponse)
def modify_order(
    payload: ApprovalActionRequest,
    current_user: CurrentUser = Depends(require_permissions("approval.approve")),
    db: Session = Depends(get_db_session),
) -> ApprovalQueueResponse:
    updated = order_service.update_order_status(db, payload.order_id, "modified", current_user)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    audit_id = audit_service.log_event(
        db,
        current_user=current_user,
        agent="Procurement Agent",
        tool="approval.approve",
        action="Approval Modified",
        entity_type="Order",
        entity_id=payload.order_id,
        status="completed",
        detail=updated["medicine_name"],
    )
    updated["trace"] = {
        **(updated.get("trace") or {}),
        "audit_id": audit_id,
    }
    db.commit()
    return ApprovalQueueResponse(**updated)
