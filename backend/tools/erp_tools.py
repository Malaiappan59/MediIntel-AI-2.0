from agents import function_tool
from sqlalchemy import select

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser
from backend.database.session import SessionLocal
from backend.emails.service import email_service
from backend.models.entities import Inventory, Supplier
from backend.services.order_service import order_service
from backend.services.erp_queries import list_alerts, list_forecasts, list_inventory_items, list_orders
from backend.services.knowledge_retrieval_service import search_knowledge_context
from backend.tools.runtime import get_runtime_context


def _tool_actor() -> CurrentUser:
    context = get_runtime_context()
    return CurrentUser(
        id=0,
        username=context.username,
        full_name=context.full_name,
        email=context.email,
        role=context.role,
        permissions=[],
        session_id="tool-runtime",
    )


@function_tool
def inventory_snapshot(top_n: int = 5) -> dict:
    """Return the current inventory posture with top at-risk medicines."""
    with SessionLocal() as db:
        items = list_inventory_items(db)
        critical = [item for item in items if item["status"] == "critical"]
        return {
            "medicine_count": len(items),
            "critical_count": len(critical),
            "predicted_shortages": len([item for item in items if item["shortage_risk"] >= 78]),
            "top_at_risk": items[:top_n],
        }


@function_tool
def forecast_snapshot() -> dict:
    """Return the latest 12-month forecast summary and predicted shortages."""
    with SessionLocal() as db:
        forecasts = list_forecasts(db)
        items = list_inventory_items(db)
        return {
            "forecasts": forecasts,
            "watchlist": items[:5],
            "days_remaining_minimum": min(item["days_remaining"] for item in items) if items else 0,
        }


@function_tool
def procurement_snapshot(limit: int = 8) -> dict:
    """Return live procurement requests and pending approvals."""
    with SessionLocal() as db:
        orders = list_orders(db, limit=limit)
        pending = [order for order in orders if order["status"] in {"pending-approval", "modified"}]
        return {
            "orders": orders[:limit],
            "pending_approvals": pending,
            "open_spend": sum(order["total_cost"] for order in pending),
        }


@function_tool
def alert_snapshot(limit: int = 8) -> dict:
    """Return the latest active operational alerts."""
    with SessionLocal() as db:
        return {"alerts": list_alerts(db, only_open=True, limit=limit)}


@function_tool
def supplier_comparison(limit: int = 5) -> dict:
    """Return supplier lead-time and fulfillment performance for current inventory risks."""
    with SessionLocal() as db:
        inventory = list_inventory_items(db)
        top_items = inventory[:limit]
        suppliers = []
        for item in top_items:
            supplier = db.scalar(select(Supplier).where(Supplier.supplier_code == item["supplier_id"]))
            if supplier is not None:
                suppliers.append(
                    {
                        "name": supplier.name,
                        "city": supplier.city,
                        "lead_time_days": supplier.lead_time_days,
                        "on_time_rate": supplier.on_time_rate,
                        "fulfillment_rate": supplier.fulfillment_rate,
                        "medicine": item["name"],
                    }
                )
        return {"suppliers": suppliers}


@function_tool
def knowledge_search(query: str, limit: int = 3) -> dict:
    """Search the knowledge repository for grounded operational context."""
    context = get_runtime_context()
    return {
        "user": context.full_name,
        "role": context.role,
        "results": search_knowledge_context(query, limit=limit),
    }


@function_tool
def send_notification_email(to_address: str, subject: str, body: str) -> dict:
    """Send an operational email notification when the user explicitly asks to notify a stakeholder."""
    context = get_runtime_context()
    delivered = email_service.send_email(to_address=to_address, subject=subject, body=body)
    return {
        "requested_by": context.full_name,
        "requested_by_email": context.email,
        "to_address": to_address,
        "subject": subject,
        "delivery_status": "sent" if delivered else "unavailable",
    }


@function_tool
def create_procurement_request(medicine_name: str | None = None, medicine_id: str | None = None, quantity: int | None = None) -> dict:
    """Create a live procurement request in the database for the specified medicine or top at-risk item."""
    current_user = _tool_actor()
    with SessionLocal() as db:
        resolved_medicine_id = medicine_id
        if medicine_name and not resolved_medicine_id:
            inventory_row = db.scalar(
                select(Inventory)
                .where(Inventory.name.ilike(medicine_name))
                .order_by(Inventory.shortage_risk.desc())
            )
            if inventory_row is not None:
                resolved_medicine_id = inventory_row.medicine_code
            else:
                return {
                    "status": "not-found",
                    "medicine_name": medicine_name,
                }

        try:
            created = order_service.generate_procurement(db, current_user, resolved_medicine_id, quantity)
        except ValueError as exc:
            return {
                "status": "failed",
                "detail": str(exc),
            }
        audit_id = audit_service.log_event(
            db,
            current_user=current_user,
            agent="Procurement Agent",
            tool="agent.procurement.create",
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
        return {
            "status": "completed",
            "order": created,
        }


@function_tool
def approve_procurement_request(order_id: str) -> dict:
    """Approve a live procurement request in the database."""
    current_user = _tool_actor()
    with SessionLocal() as db:
        updated = order_service.update_order_status(db, order_id, "approved", current_user)
        if updated is None:
            return {
                "status": "not-found",
                "order_id": order_id,
            }

        audit_id = audit_service.log_event(
            db,
            current_user=current_user,
            agent="Procurement Agent",
            tool="agent.procurement.approve",
            action="Purchase Request Approved",
            entity_type="Order",
            entity_id=updated["id"],
            status="completed",
            detail=f"{updated['medicine_name']} approved by {current_user.full_name}",
        )
        updated["trace"] = {
            **(updated.get("trace") or {}),
            "audit_id": audit_id,
        }
        db.commit()
        return {
            "status": "completed",
            "order": updated,
        }


@function_tool
def reject_procurement_request(order_id: str) -> dict:
    """Reject a live procurement request in the database."""
    current_user = _tool_actor()
    with SessionLocal() as db:
        updated = order_service.update_order_status(db, order_id, "rejected", current_user)
        if updated is None:
            return {
                "status": "not-found",
                "order_id": order_id,
            }

        audit_id = audit_service.log_event(
            db,
            current_user=current_user,
            agent="Procurement Agent",
            tool="agent.procurement.reject",
            action="Purchase Request Rejected",
            entity_type="Order",
            entity_id=updated["id"],
            status="completed",
            detail=f"{updated['medicine_name']} rejected by {current_user.full_name}",
        )
        updated["trace"] = {
            **(updated.get("trace") or {}),
            "audit_id": audit_id,
        }
        db.commit()
        return {
            "status": "completed",
            "order": updated,
        }
