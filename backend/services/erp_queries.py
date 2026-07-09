from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.entities import Alert, ApiRegistry, Approval, ApprovalHistory, AuditLog, ChatHistory, FileRecord, Forecast, Hospital, Inventory, Order, Supplier


def get_hospital_profile(db: Session) -> dict:
    hospital = db.scalar(select(Hospital).order_by(Hospital.id.asc()))
    if hospital is None:
        raise ValueError("Hospital profile is not available in the database.")

    departments = sorted(
        {
            record.department_name
            for record in db.scalars(select(Inventory.department_name).distinct()).all()
            if record is not None
        }
    )
    return {
        "name": hospital.name,
        "tagline": hospital.tagline,
        "location": hospital.location,
        "mission": hospital.mission,
        "beds": hospital.beds,
        "departments": departments,
    }


def _aggregate_inventory_rows(rows: list[Inventory]) -> list[dict]:
    grouped: dict[str, dict] = {}
    department_map: dict[str, set[str]] = defaultdict(set)

    for row in rows:
        key = row.name
        department_map[key].add(row.department_name)
        if key not in grouped:
            grouped[key] = {
                "id": row.name,
                "medicine_code": row.medicine_code,
                "name": row.name,
                "category": row.category,
                "unit": row.unit,
                "supplier_id": row.supplier_code,
                "stock_on_hand": row.stock_on_hand,
                "reorder_level": row.reorder_level,
                "daily_consumption": row.daily_consumption,
                "days_remaining": row.days_remaining,
                "expiry_date": row.expiry_date.isoformat(),
                "unit_cost": row.unit_cost,
                "status": row.status,
                "shortage_risk": row.shortage_risk,
            }
            continue

        entry = grouped[key]
        entry["stock_on_hand"] += row.stock_on_hand
        entry["reorder_level"] += row.reorder_level
        entry["daily_consumption"] += row.daily_consumption
        entry["days_remaining"] = min(entry["days_remaining"], row.days_remaining)
        entry["expiry_date"] = min(entry["expiry_date"], row.expiry_date.isoformat())
        entry["unit_cost"] = round((entry["unit_cost"] + row.unit_cost) / 2, 2)
        entry["shortage_risk"] = max(entry["shortage_risk"], row.shortage_risk)

        if row.status == "critical" or entry["status"] == "critical":
            entry["status"] = "critical"
        elif row.status == "watch" or entry["status"] == "watch":
            entry["status"] = "watch"

    items = list(grouped.values())
    for item in items:
        item["id"] = item["name"].lower().replace(" ", "-")
    return sorted(items, key=lambda item: (item["status"] != "critical", -item["shortage_risk"], item["days_remaining"]))


def list_inventory_items(db: Session) -> list[dict]:
    rows = list(db.scalars(select(Inventory).order_by(Inventory.name.asc(), Inventory.shortage_risk.desc())).all())
    return _aggregate_inventory_rows(rows)


def list_suppliers(db: Session) -> list[dict]:
    rows = list(db.scalars(select(Supplier).order_by(Supplier.name.asc())).all())
    return [
        {
            "id": row.supplier_code,
            "name": row.name,
            "city": row.city,
            "specialty": row.specialty,
            "contact": row.contact,
            "lead_time_days": row.lead_time_days,
            "on_time_rate": row.on_time_rate,
            "fulfillment_rate": row.fulfillment_rate,
        }
        for row in rows
    ]


def list_forecasts(db: Session) -> list[dict]:
    rows = list(db.scalars(select(Forecast).order_by(Forecast.id.asc())).all())
    return [
        {
            "id": row.forecast_code,
            "month": row.month,
            "consumption": row.consumption,
            "forecast": row.forecast,
            "shortage_index": row.shortage_index,
        }
        for row in rows
    ]


def list_orders(db: Session, *, limit: int | None = None) -> list[dict]:
    statement = select(Order).order_by(Order.created_at.desc())
    if limit is not None:
        statement = statement.limit(limit)

    rows = list(db.scalars(statement).all())
    approvals = {
        approval.order_code: approval
        for approval in db.scalars(select(Approval).order_by(Approval.created_at.desc())).all()
    }
    latest_histories: dict[str, ApprovalHistory] = {}
    for history in db.scalars(select(ApprovalHistory).order_by(ApprovalHistory.created_at.desc())).all():
        latest_histories.setdefault(history.approval_code, history)
    latest_audits: dict[str, AuditLog] = {}
    for audit in db.scalars(
        select(AuditLog).where(AuditLog.entity_type == "Order").order_by(AuditLog.created_at.desc())
    ).all():
        latest_audits.setdefault(audit.entity_id, audit)

    return [
        {
            "id": row.order_code,
            "medicine_id": row.medicine_code,
            "medicine_name": row.medicine_name,
            "supplier_id": row.supplier_code,
            "supplier_name": row.supplier_name,
            "quantity": row.quantity,
            "unit_cost": row.unit_cost,
            "total_cost": row.total_cost,
            "status": row.status,
            "requested_by": row.requested_by,
            "created_at": row.created_at.isoformat(),
            "eta": row.eta.isoformat(),
            "priority": row.priority,
            "trace": (
                {
                    "approval_id": approvals[row.order_code].approval_code,
                    "approval_history_id": latest_histories[approvals[row.order_code].approval_code].history_code
                    if approvals[row.order_code].approval_code in latest_histories
                    else None,
                    "audit_id": latest_audits[row.order_code].event_code if row.order_code in latest_audits else None,
                    "assigned_role": approvals[row.order_code].assigned_role,
                    "last_action": latest_histories[approvals[row.order_code].approval_code].action
                    if approvals[row.order_code].approval_code in latest_histories
                    else None,
                    "last_action_at": approvals[row.order_code].last_action_at.isoformat()
                    if approvals[row.order_code].last_action_at is not None
                    else None,
                }
                if row.order_code in approvals
                else None
            ),
        }
        for row in rows
    ]


def list_alerts(db: Session, *, only_open: bool = False, limit: int | None = None) -> list[dict]:
    statement = select(Alert).order_by(Alert.event_time.desc())
    if only_open:
        statement = statement.where(Alert.status == "open")
    if limit is not None:
        statement = statement.limit(limit)

    rows = list(db.scalars(statement).all())
    return [
        {
            "id": row.alert_code,
            "title": row.title,
            "description": row.description,
            "severity": row.severity,
            "source": row.source,
            "time": row.event_time.isoformat(),
            "status": row.status,
            "medicine_name": row.medicine_name,
        }
        for row in rows
    ]


def list_files(db: Session) -> list[dict]:
    rows = list(db.scalars(select(FileRecord).order_by(FileRecord.upload_date.desc())).all())
    return [
        {
            "id": row.file_code,
            "filename": row.filename,
            "category": row.category,
            "upload_date": row.upload_date.isoformat(),
            "uploaded_by": row.uploaded_by,
            "status": row.status,
            "size_label": row.size_label,
            "summary": row.summary,
            "download_content": row.download_content,
        }
        for row in rows
    ]


def list_apis(db: Session) -> list[dict]:
    rows = list(db.scalars(select(ApiRegistry).order_by(ApiRegistry.last_checked_at.desc())).all())
    return [
        {
            "id": row.api_code,
            "name": row.name,
            "endpoint": row.endpoint,
            "method": row.method,
            "status": row.status,
            "authentication": row.authentication,
            "description": row.description,
            "latency_ms": row.latency_ms,
            "last_checked_at": row.last_checked_at.isoformat(),
        }
        for row in rows
    ]


def list_audit_logs(db: Session, *, limit: int | None = 100) -> list[dict]:
    statement = select(AuditLog).order_by(AuditLog.created_at.desc())
    if limit is not None:
        statement = statement.limit(limit)

    rows = list(db.scalars(statement).all())
    return [
        {
            "id": row.event_code,
            "time": row.created_at.isoformat(),
            "agent": row.agent or "System",
            "action": row.action,
            "status": row.status,
            "user": row.actor,
            "detail": str((row.event_metadata or {}).get("detail") or row.entity_id),
            "tool": row.tool,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
        }
        for row in rows
    ]


def list_chat_history(db: Session, *, username: str, limit: int | None = 30) -> list[dict]:
    statement = (
        select(ChatHistory)
        .where(ChatHistory.username == username)
        .order_by(ChatHistory.created_at.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)

    rows = list(reversed(list(db.scalars(statement).all())))
    return [
        {
            "id": row.message_code,
            "role": row.role,
            "content": row.content,
            "created_at": row.created_at.isoformat(),
            "confidence": row.confidence,
            "reasoning": row.reasoning,
            "structured_payload": row.structured_payload,
        }
        for row in rows
    ]
