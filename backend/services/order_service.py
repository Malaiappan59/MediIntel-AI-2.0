from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser
from backend.models.entities import Approval, ApprovalHistory, Inventory, Order, Supplier
from backend.schemas.orders import ProcurementOrderCreate
from backend.services.erp_queries import list_inventory_items, list_orders


class OrderService:
    def list_orders(self, db: Session) -> list[dict]:
        return list_orders(db)

    def _serialize_order(
        self,
        db: Session,
        order: Order,
        approval: Approval | None = None,
        latest_history: ApprovalHistory | None = None,
        audit_id: str | None = None,
    ) -> dict:
        approval = approval or db.scalar(select(Approval).where(Approval.order_code == order.order_code))
        if approval is not None and latest_history is None:
            latest_history = db.scalar(
                select(ApprovalHistory)
                .where(ApprovalHistory.approval_code == approval.approval_code)
                .order_by(ApprovalHistory.created_at.desc())
            )

        trace = None
        if approval is not None or audit_id is not None:
            trace = {
                "approval_id": approval.approval_code if approval is not None else None,
                "approval_history_id": latest_history.history_code if latest_history is not None else None,
                "audit_id": audit_id,
                "assigned_role": approval.assigned_role if approval is not None else None,
                "last_action": latest_history.action if latest_history is not None else None,
                "last_action_at": approval.last_action_at.isoformat() if approval is not None and approval.last_action_at is not None else None,
            }

        return {
            "id": order.order_code,
            "medicine_id": order.medicine_code,
            "medicine_name": order.medicine_name,
            "supplier_id": order.supplier_code,
            "supplier_name": order.supplier_name,
            "quantity": order.quantity,
            "unit_cost": order.unit_cost,
            "total_cost": order.total_cost,
            "status": order.status,
            "requested_by": order.requested_by,
            "created_at": order.created_at.isoformat(),
            "eta": order.eta.isoformat(),
            "priority": order.priority,
            "trace": trace,
        }

    def _create_approval(self, db: Session, order_code: str, requested_by: str) -> tuple[Approval, ApprovalHistory]:
        approval_count = db.scalar(select(func.count()).select_from(Approval)) or 0
        approval = Approval(
            approval_code=f"APR-{approval_count + 1:04d}",
            order_code=order_code,
            status="pending-approval",
            assigned_role="Procurement Manager",
            requested_by=requested_by,
            last_action_at=None,
            created_at=datetime.now(UTC),
        )
        db.add(approval)
        db.flush()
        history_count = db.scalar(select(func.count()).select_from(ApprovalHistory)) or 0
        history = ApprovalHistory(
            history_code=f"APH-{history_count + 1:04d}",
            approval_code=approval.approval_code,
            action="queued",
            comment="Awaiting procurement review.",
            acted_by=requested_by,
            acted_role="Inventory Manager",
            created_at=datetime.now(UTC),
        )
        db.add(history)
        db.flush()
        return approval, history

    def create_order(self, db: Session, payload: ProcurementOrderCreate) -> dict:
        order_count = db.scalar(select(func.count()).select_from(Order)) or 0
        inventory_row = None
        if payload.medicine_code:
            inventory_row = db.scalar(
                select(Inventory)
                .where(Inventory.medicine_code == payload.medicine_code)
                .order_by(Inventory.shortage_risk.desc())
            )
        if inventory_row is None:
            inventory_row = db.scalar(
                select(Inventory)
                .where(Inventory.name == payload.medicine_name)
                .order_by(Inventory.shortage_risk.desc())
            )

        supplier = None
        if payload.supplier_code:
            supplier = db.scalar(select(Supplier).where(Supplier.supplier_code == payload.supplier_code))
        if supplier is None:
            supplier = db.scalar(select(Supplier).where(Supplier.name == payload.supplier_name))
        if supplier is None and inventory_row is not None:
            supplier = db.scalar(select(Supplier).where(Supplier.supplier_code == inventory_row.supplier_code))

        supplier_code = supplier.supplier_code if supplier else payload.supplier_code or "SUP-UNKNOWN"
        supplier_name = supplier.name if supplier else payload.supplier_name
        unit_cost = float(payload.unit_cost if payload.unit_cost is not None else inventory_row.unit_cost if inventory_row is not None else 0.0)
        eta_days = payload.eta_days if payload.eta_days is not None else supplier.lead_time_days if supplier is not None else 4
        medicine_code = payload.medicine_code or (inventory_row.medicine_code if inventory_row is not None else f"MED-ORDER-{order_count + 1:04d}")
        record = Order(
            order_code=f"PO-{order_count + 1:04d}",
            medicine_code=medicine_code,
            medicine_name=payload.medicine_name,
            supplier_code=supplier_code,
            supplier_name=supplier_name,
            quantity=payload.quantity,
            unit_cost=unit_cost,
            total_cost=unit_cost * payload.quantity,
            status="pending-approval",
            requested_by=payload.requested_by,
            created_at=datetime.now(UTC),
            eta=datetime.now(UTC) + timedelta(days=eta_days),
            priority=payload.priority,
        )
        db.add(record)
        db.flush()
        approval, history = self._create_approval(db, record.order_code, payload.requested_by)
        db.commit()
        db.refresh(record)
        return self._serialize_order(db, record, approval, history)

    def generate_procurement(self, db: Session, current_user: CurrentUser, medicine_id: str | None = None, quantity: int | None = None) -> dict:
        inventory_items = list_inventory_items(db)
        if not inventory_items:
            raise ValueError("No inventory records are available.")

        normalized_lookup = medicine_id.lower().strip() if medicine_id else None
        target = next(
            (
                item
                for item in inventory_items
                if normalized_lookup
                and (
                    item["id"] == normalized_lookup
                    or str(item.get("medicine_code", "")).lower() == normalized_lookup
                    or item["name"].lower() == normalized_lookup
                )
            ),
            None,
        )
        if normalized_lookup and target is None:
            raise ValueError(f"Medicine '{medicine_id}' was not found in live inventory.")
        target = target or inventory_items[0]
        supplier = db.scalar(select(Supplier).where(Supplier.supplier_code == target["supplier_id"]))
        order_quantity = quantity or max(target["reorder_level"] * 2 - target["stock_on_hand"], target["daily_consumption"] * 10)
        payload = ProcurementOrderCreate(
            medicine_name=target["name"],
            supplier_name=supplier.name if supplier else "Primary Supplier",
            quantity=order_quantity,
            requested_by=current_user.full_name,
            priority="critical" if target["status"] == "critical" else "warning",
            medicine_code=target.get("medicine_code"),
            supplier_code=target["supplier_id"],
            unit_cost=float(target["unit_cost"]),
            eta_days=supplier.lead_time_days if supplier is not None else 4,
        )
        return self.create_order(db, payload)

    def update_order_status(self, db: Session, order_code: str, status_value: str, current_user: CurrentUser) -> dict | None:
        order = db.scalar(select(Order).where(Order.order_code == order_code))
        if order is None:
            return None

        order.status = status_value
        approval = db.scalar(select(Approval).where(Approval.order_code == order_code))
        history: ApprovalHistory | None = None
        if approval is not None:
            approval.status = status_value
            approval.last_action_at = datetime.now(UTC)
            history_count = db.scalar(select(func.count()).select_from(ApprovalHistory)) or 0
            history = ApprovalHistory(
                history_code=f"APH-{history_count + 1:04d}",
                approval_code=approval.approval_code,
                action=status_value,
                comment=f"Order {status_value} by {current_user.full_name}.",
                acted_by=current_user.full_name,
                acted_role=current_user.role,
                created_at=datetime.now(UTC),
            )
            db.add(history)

        db.commit()
        db.refresh(order)
        return self._serialize_order(db, order, approval, history)


order_service = OrderService()
