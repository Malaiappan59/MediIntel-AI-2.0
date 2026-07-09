from datetime import datetime

from sqlalchemy import delete, func, select

from backend.database.mock_seed import create_seed_dataset
from backend.database.session import SessionLocal
from backend.models.entities import (
    Alert,
    ApiRegistry,
    Approval,
    ApprovalHistory,
    AuditLog,
    ChatHistory,
    ChatSession,
    ConsumptionHistory,
    Department,
    FileRecord,
    Forecast,
    Hospital,
    Inventory,
    Invoice,
    Medicine,
    Order,
    Permission,
    Role,
    RolePermission,
    Supplier,
    User,
    UserSession,
    VendorContract,
    Warehouse,
)


def _dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _database_already_seeded(session) -> bool:
    return session.scalar(select(User.id).limit(1)) is not None


SEED_RESET_MODELS = [
    RolePermission,
    ApprovalHistory,
    UserSession,
    ChatHistory,
    ChatSession,
    AuditLog,
    ApiRegistry,
    FileRecord,
    Alert,
    Invoice,
    VendorContract,
    Approval,
    Order,
    ConsumptionHistory,
    Forecast,
    Inventory,
    Supplier,
    User,
    Medicine,
    Warehouse,
    Department,
    Permission,
    Role,
    Hospital,
]

SEED_SUMMARY_MODELS = {
    "hospitals": Hospital,
    "users": User,
    "suppliers": Supplier,
    "inventory": Inventory,
    "forecasts": Forecast,
    "orders": Order,
    "approvals": Approval,
    "alerts": Alert,
    "files": FileRecord,
    "apis": ApiRegistry,
    "audit_logs": AuditLog,
    "chat_sessions": ChatSession,
    "chat_history": ChatHistory,
}


def reset_seed_data(session) -> None:
    for model in SEED_RESET_MODELS:
        session.execute(delete(model))
    session.commit()


def get_seed_summary(session=None) -> dict[str, int]:
    owns_session = session is None
    session = session or SessionLocal()

    try:
        return {
            label: int(session.scalar(select(func.count()).select_from(model)) or 0)
            for label, model in SEED_SUMMARY_MODELS.items()
        }
    finally:
        if owns_session:
            session.close()


def seed_database(skip_if_seeded: bool = True, reset_existing: bool = False) -> bool:
    dataset = create_seed_dataset()
    session = SessionLocal()

    try:
        if reset_existing:
            reset_seed_data(session)
        elif _database_already_seeded(session):
            if skip_if_seeded:
                return False
            raise RuntimeError("Database already contains demo data. Use reset_existing=True to replace it.")

        session.add_all(
            [
                Hospital(
                    hospital_code=row["hospital_code"],
                    name=row["name"],
                    tagline=row["tagline"],
                    location=row["location"],
                    mission=row["mission"],
                    beds=row["beds"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["hospitals"]
            ]
        )

        session.add_all(
            [
                Role(
                    name=row["name"],
                    description=row["description"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["roles"]
            ]
        )

        session.add_all(
            [
                Permission(
                    code=row["code"],
                    description=row["description"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["permissions"]
            ]
        )
        session.flush()

        role_id_by_name = {
            role.name: role.id
            for role in session.scalars(select(Role)).all()
        }
        permission_id_by_code = {
            permission.code: permission.id
            for permission in session.scalars(select(Permission)).all()
        }

        session.add_all(
            [
                RolePermission(
                    role_id=role_id_by_name[row["role_name"]],
                    permission_id=permission_id_by_code[row["permission_code"]],
                )
                for row in dataset["role_permissions"]
            ]
        )

        session.add_all(
            [
                Department(
                    department_code=row["department_code"],
                    name=row["name"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["departments"]
            ]
        )

        session.add_all(
            [
                Warehouse(
                    warehouse_code=row["warehouse_code"],
                    name=row["name"],
                    department_name=row["department_name"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["warehouses"]
            ]
        )

        session.add_all(
            [
                Medicine(
                    medicine_code=row["medicine_code"],
                    name=row["name"],
                    category=row["category"],
                    unit=row["unit"],
                    therapeutic_class=row["therapeutic_class"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["medicines"]
            ]
        )

        session.add_all(
            [
                User(
                    username=row["username"],
                    full_name=row["full_name"],
                    role=row["role"],
                    email=row["email"],
                    password_hash=row["password_hash"],
                    is_active=row["is_active"],
                    last_login_at=_dt(row["last_login_at"]),
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["users"]
            ]
        )

        session.add_all(
            [
                Supplier(
                    supplier_code=row["supplier_code"],
                    name=row["name"],
                    city=row["city"],
                    specialty=row["specialty"],
                    contact=row["contact"],
                    lead_time_days=row["lead_time_days"],
                    on_time_rate=row["on_time_rate"],
                    fulfillment_rate=row["fulfillment_rate"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["suppliers"]
            ]
        )

        session.add_all(
            [
                Inventory(
                    medicine_code=row["medicine_code"],
                    name=row["name"],
                    category=row["category"],
                    unit=row["unit"],
                    supplier_code=row["supplier_code"],
                    department_name=row["department_name"],
                    warehouse_name=row["warehouse_name"],
                    stock_on_hand=row["stock_on_hand"],
                    reorder_level=row["reorder_level"],
                    daily_consumption=row["daily_consumption"],
                    days_remaining=row["days_remaining"],
                    expiry_date=_dt(row["expiry_date"]),
                    unit_cost=row["unit_cost"],
                    status=row["status"],
                    shortage_risk=row["shortage_risk"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["inventory"]
            ]
        )

        session.add_all(
            [
                Forecast(
                    forecast_code=row["forecast_code"],
                    month=row["month"],
                    consumption=row["consumption"],
                    forecast=row["forecast"],
                    shortage_index=row["shortage_index"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["forecasts"]
            ]
        )

        session.add_all(
            [
                ConsumptionHistory(
                    history_code=row["history_code"],
                    medicine_name=row["medicine_name"],
                    department_name=row["department_name"],
                    period_label=row["period_label"],
                    quantity=row["quantity"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["consumption_history"]
            ]
        )

        session.add_all(
            [
                Order(
                    order_code=row["order_code"],
                    medicine_code=row["medicine_code"],
                    medicine_name=row["medicine_name"],
                    supplier_code=row["supplier_code"],
                    supplier_name=row["supplier_name"],
                    quantity=row["quantity"],
                    unit_cost=row["unit_cost"],
                    total_cost=row["total_cost"],
                    status=row["status"],
                    requested_by=row["requested_by"],
                    created_at=_dt(row["created_at"]),
                    eta=_dt(row["eta"]),
                    priority=row["priority"],
                )
                for row in dataset["orders"]
            ]
        )

        session.add_all(
            [
                Approval(
                    approval_code=row["approval_code"],
                    order_code=row["order_code"],
                    status=row["status"],
                    assigned_role=row["assigned_role"],
                    requested_by=row["requested_by"],
                    last_action_at=_dt(row["last_action_at"]),
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["approvals"]
            ]
        )

        session.add_all(
            [
                ApprovalHistory(
                    history_code=row["history_code"],
                    approval_code=row["approval_code"],
                    action=row["action"],
                    comment=row["comment"],
                    acted_by=row["acted_by"],
                    acted_role=row["acted_role"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["approval_history"]
            ]
        )

        session.add_all(
            [
                VendorContract(
                    contract_code=row["contract_code"],
                    supplier_code=row["supplier_code"],
                    title=row["title"],
                    effective_from=_dt(row["effective_from"]),
                    effective_to=_dt(row["effective_to"]),
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["vendor_contracts"]
            ]
        )

        session.add_all(
            [
                Invoice(
                    invoice_code=row["invoice_code"],
                    order_code=row["order_code"],
                    supplier_code=row["supplier_code"],
                    amount=row["amount"],
                    status=row["status"],
                    issued_at=_dt(row["issued_at"]),
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["invoices"]
            ]
        )

        session.add_all(
            [
                Alert(
                    alert_code=row["alert_code"],
                    title=row["title"],
                    description=row["description"],
                    severity=row["severity"],
                    source=row["source"],
                    event_time=_dt(row["event_time"]),
                    status=row["status"],
                    medicine_name=row["medicine_name"],
                )
                for row in dataset["alerts"]
            ]
        )

        session.add_all(
            [
                FileRecord(
                    file_code=row["file_code"],
                    filename=row["filename"],
                    category=row["category"],
                    upload_date=_dt(row["upload_date"]),
                    uploaded_by=row["uploaded_by"],
                    status=row["status"],
                    size_label=row["size_label"],
                    summary=row["summary"],
                    download_content=row["download_content"],
                )
                for row in dataset["files"]
            ]
        )

        session.add_all(
            [
                ApiRegistry(
                    api_code=row["api_code"],
                    name=row["name"],
                    endpoint=row["endpoint"],
                    method=row["method"],
                    status=row["status"],
                    authentication=row["authentication"],
                    description=row["description"],
                    latency_ms=row["latency_ms"],
                    last_checked_at=_dt(row["last_checked_at"]),
                )
                for row in dataset["apis"]
            ]
        )

        session.add_all(
            [
                AuditLog(
                    event_code=row["event_code"],
                    actor=row["actor"],
                    user_role=row["user_role"],
                    agent=row["agent"],
                    tool=row["tool"],
                    action=row["action"],
                    entity_type=row["entity_type"],
                    entity_id=row["entity_id"],
                    status=row["status"],
                    execution_time_ms=row["execution_time_ms"],
                    ip_address=row["ip_address"],
                    event_metadata=row["metadata"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["audit_logs"]
            ]
        )

        session.add_all(
            [
                ChatSession(
                    session_code=row["session_code"],
                    username=row["username"],
                    goal=row["goal"],
                    status=row["status"],
                    created_at=_dt(row["created_at"]),
                    updated_at=_dt(row["updated_at"]),
                )
                for row in dataset["chat_sessions"]
            ]
        )

        session.add_all(
            [
                ChatHistory(
                    message_code=row["message_code"],
                    session_code=row["session_code"],
                    username=row["username"],
                    role=row["role"],
                    content=row["content"],
                    confidence=row["confidence"],
                    reasoning=row["reasoning"],
                    structured_payload=row["structured_payload"],
                    created_at=_dt(row["created_at"]),
                )
                for row in dataset["chat_history"]
            ]
        )

        session.add_all(
            [
                UserSession(
                    session_code=row["session_code"],
                    username=row["username"],
                    refresh_token_hash=row["refresh_token_hash"],
                    ip_address=row["ip_address"],
                    user_agent=row["user_agent"],
                    issued_at=_dt(row["issued_at"]),
                    expires_at=_dt(row["expires_at"]),
                    revoked_at=_dt(row["revoked_at"]),
                )
                for row in dataset.get("user_sessions", [])
            ]
        )

        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    was_seeded = seed_database()
    print("Development seed completed." if was_seeded else "Seed skipped because data already exists.")
