import json
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path

from backend.utils.permissions import ROLE_PERMISSIONS, all_permission_codes
from backend.utils.security import hash_password


def _reference_path() -> Path:
    return Path(__file__).resolve().parents[2] / "database" / "reference-data.json"


def load_reference_data() -> dict:
    with _reference_path().open("r", encoding="utf-8") as file_handle:
        return json.load(file_handle)


def _now() -> datetime:
    return datetime.now(UTC)


def _iso_date(days: int = 0, hours: int = 0) -> str:
    return (_now() + timedelta(days=days, hours=hours)).isoformat()


def _shift_iso(value: str, *, days: int = 0, hours: int = 0) -> str:
    return (datetime.fromisoformat(value) + timedelta(days=days, hours=hours)).isoformat()


def create_hospitals() -> list[dict]:
    reference_data = load_reference_data()
    hospital = reference_data.get("hospital", {})
    return [
        {
            "id": 1,
            "hospital_code": "HSP-001",
            "name": hospital.get("name", "CityCare Multi-Speciality Hospital"),
            "tagline": hospital.get("tagline", "Predict. Prevent. Procure."),
            "location": hospital.get("location", "Chennai, India"),
            "mission": hospital.get("mission", "Prevent medicine shortages before they impact patient care."),
            "beds": hospital.get("beds", 420),
            "created_at": _iso_date(days=-365),
        }
    ]


def create_roles() -> list[dict]:
    descriptions = {
        "Admin": "Full administrative access to MediIntel operations, approvals, and configuration.",
        "Inventory Manager": "Monitors stock posture, shortages, and knowledge uploads across hospital inventory.",
        "Procurement Manager": "Approves AI procurement recommendations and routes supplier-side execution.",
        "Pharmacist": "Validates medicine continuity, clinical inventory risk, and recommendation relevance.",
        "Auditor": "Reviews traceability, AI audit logs, and approval lifecycle history.",
        "Viewer": "Read-only access to executive inventory, forecast, and alert information.",
    }
    return [
        {
            "id": index + 1,
            "name": role_name,
            "description": descriptions[role_name],
            "created_at": _iso_date(days=-180 + index),
        }
        for index, role_name in enumerate(ROLE_PERMISSIONS)
    ]


def create_permissions() -> list[dict]:
    description_map = {
        "inventory.read": "View inventory health, medicine stock, and continuity indicators.",
        "forecast.read": "View forecast data, predicted shortages, and demand trends.",
        "recommendation.generate": "Generate AI-powered supply and operational recommendations.",
        "approval.approve": "Approve AI-generated procurement and operational actions.",
        "approval.reject": "Reject or return AI-generated procurement and operational actions.",
        "purchase_order.generate": "Create procurement requests and supplier-bound purchase workflows.",
        "knowledge.upload": "Upload knowledge files into the retrieval repository.",
        "knowledge.delete": "Delete knowledge files from the retrieval repository.",
        "audit.read": "Review AI, user, and workflow audit history.",
        "settings.manage": "Manage user and workspace settings.",
        "api.manage": "Create and remove ERP-facing integration definitions.",
    }
    return [
        {
            "id": index + 1,
            "code": code,
            "description": description_map.get(code, code),
            "created_at": _iso_date(days=-170 + index),
        }
        for index, code in enumerate(all_permission_codes())
    ]


def create_role_permissions(roles: list[dict], permissions: list[dict]) -> list[dict]:
    role_id_by_name = {role["name"]: role["id"] for role in roles}
    permission_id_by_code = {permission["code"]: permission["id"] for permission in permissions}
    rows: list[dict] = []
    next_id = 1

    for role_name, permission_codes in ROLE_PERMISSIONS.items():
        for code in permission_codes:
            rows.append(
                {
                    "id": next_id,
                    "role_id": role_id_by_name[role_name],
                    "permission_id": permission_id_by_code[code],
                    "role_name": role_name,
                    "permission_code": code,
                }
            )
            next_id += 1

    return rows


def create_departments() -> list[dict]:
    department_names = [
        "ICU",
        "Emergency",
        "Pharmacy",
        "Oncology",
        "Cardiology",
        "Pediatrics",
    ]
    return [
        {
            "id": index + 1,
            "department_code": f"DEP-{index + 1:03d}",
            "name": name,
            "created_at": _iso_date(days=-250 + index),
        }
        for index, name in enumerate(department_names)
    ]


def create_warehouses(departments: list[dict]) -> list[dict]:
    return [
        {
            "id": index + 1,
            "warehouse_code": f"WH-{index + 1:03d}",
            "name": f"{department['name']} Central Store",
            "department_name": department["name"],
            "created_at": _iso_date(days=-220 + index),
        }
        for index, department in enumerate(departments)
    ]


def _medicine_name(base_name: str, cycle: int, index: int) -> str:
    strengths = ["50mg", "75mg", "100mg", "125mg", "250mg", "500mg", "650mg", "750mg", "900mg", "1g"]
    forms = ["Tablet", "Capsule", "Injection", "Vial", "Suspension"]
    return f"{base_name} {strengths[cycle % len(strengths)]} {forms[(cycle + index) % len(forms)]}"


def create_medicines() -> list[dict]:
    reference_data = load_reference_data()
    base_medicines = reference_data.get("medicines", [])
    if not base_medicines:
        raise ValueError("Reference data must include at least one medicine.")

    return [
        {
            "id": index + 1,
            "medicine_code": f"MED-{index + 1:04d}",
            "name": template["name"],
            "category": template["category"],
            "unit": template["unit"],
            "therapeutic_class": template["category"],
            "created_at": _iso_date(days=-300 + (index % 120)),
        }
        for index, template in enumerate(base_medicines)
    ]


def create_users() -> list[dict]:
    default_password = hash_password("MediIntel@123")
    return [
        {
            "id": 1,
            "username": "admin",
            "full_name": "Saikiran Reddy",
            "role": "Admin",
            "email": "saikiran.reddy@citycarehospital.org",
            "password_hash": default_password,
            "is_active": True,
            "last_login_at": None,
            "created_at": _iso_date(days=-30),
        },
        {
            "id": 2,
            "username": "inventory.manager",
            "full_name": "Ritika Sharma",
            "role": "Inventory Manager",
            "email": "ritika.sharma@citycarehospital.org",
            "password_hash": default_password,
            "is_active": True,
            "last_login_at": None,
            "created_at": _iso_date(days=-24),
        },
        {
            "id": 3,
            "username": "procurement.manager",
            "full_name": "Lavanya Iyer",
            "role": "Procurement Manager",
            "email": "lavanya.iyer@citycarehospital.org",
            "password_hash": default_password,
            "is_active": True,
            "last_login_at": None,
            "created_at": _iso_date(days=-22),
        },
        {
            "id": 4,
            "username": "pharmacist",
            "full_name": "Ajay Mathew",
            "role": "Pharmacist",
            "email": "ajay.mathew@citycarehospital.org",
            "password_hash": default_password,
            "is_active": True,
            "last_login_at": None,
            "created_at": _iso_date(days=-21),
        },
        {
            "id": 5,
            "username": "auditor",
            "full_name": "Neha Arora",
            "role": "Auditor",
            "email": "neha.arora@citycarehospital.org",
            "password_hash": default_password,
            "is_active": True,
            "last_login_at": None,
            "created_at": _iso_date(days=-20),
        },
        {
            "id": 6,
            "username": "viewer",
            "full_name": "Arun Prakash",
            "role": "Viewer",
            "email": "arun.prakash@citycarehospital.org",
            "password_hash": default_password,
            "is_active": True,
            "last_login_at": None,
            "created_at": _iso_date(days=-18),
        },
    ]


def create_suppliers() -> list[dict]:
    reference_data = load_reference_data()
    base_suppliers = reference_data.get("suppliers", [])
    if not base_suppliers:
        raise ValueError("Reference data must include at least one supplier.")

    supplier_profiles = [
        (2, 98, 97),
        (3, 96, 95),
        (4, 94, 94),
        (3, 95, 93),
        (5, 91, 92),
        (6, 88, 90),
        (2, 97, 98),
        (5, 90, 91),
        (1, 99, 96),
        (4, 93, 92),
    ]

    return [
        {
            "id": index + 1,
            "supplier_code": f"SUP-{index + 1:03d}",
            "name": template["name"],
            "city": template["city"],
            "specialty": template["specialty"],
            "contact": template["contact"],
            "lead_time_days": supplier_profiles[index % len(supplier_profiles)][0],
            "on_time_rate": supplier_profiles[index % len(supplier_profiles)][1],
            "fulfillment_rate": supplier_profiles[index % len(supplier_profiles)][2],
            "created_at": _iso_date(days=-90 + index),
        }
        for index, template in enumerate(base_suppliers)
    ]


def create_inventory(
    medicines: list[dict] | None = None,
    suppliers: list[dict] | None = None,
    departments: list[dict] | None = None,
    warehouses: list[dict] | None = None,
) -> list[dict]:
    medicines = medicines or create_medicines()
    suppliers = suppliers or create_suppliers()
    departments = departments or create_departments()
    warehouses = warehouses or create_warehouses(departments)
    inventory: list[dict] = []
    next_id = 1

    for medicine_index, medicine in enumerate(medicines):
        for lane_index in range(len(warehouses)):
            supplier = suppliers[(medicine_index + lane_index) % len(suppliers)]
            warehouse = warehouses[lane_index]
            baseline_stock = 118 + ((medicine_index * 17 + lane_index * 23) % 210)
            reorder_level = 96 + ((medicine_index * 9 + lane_index * 11) % 90)
            daily_consumption = 5 + ((medicine_index + lane_index) % 9) * 2
            expiry_window_days = 110 + ((medicine_index * 7 + lane_index * 13) % 180)

            if medicine_index < 12:
                baseline_stock = 18 + lane_index * 6 + (medicine_index % 3) * 5
                reorder_level = 114 + lane_index * 9 + (medicine_index % 5) * 6
                daily_consumption = 12 + ((medicine_index + lane_index) % 5) * 3
                expiry_window_days = 32 + ((medicine_index * 5 + lane_index * 7) % 50)
            elif medicine_index < 28:
                baseline_stock = 44 + lane_index * 8 + (medicine_index % 4) * 7
                reorder_level = 102 + lane_index * 7 + (medicine_index % 6) * 5
                daily_consumption = 9 + ((medicine_index + lane_index) % 6) * 2
                expiry_window_days = 48 + ((medicine_index * 7 + lane_index * 5) % 84)
            elif medicine_index % 17 == 0:
                baseline_stock = 84 + lane_index * 10 + (medicine_index % 5) * 6
                reorder_level = 108 + lane_index * 4
                daily_consumption = 6 + ((medicine_index + lane_index) % 5) * 2
                expiry_window_days = 16 + ((medicine_index * 3 + lane_index * 2) % 22)
            elif supplier["lead_time_days"] >= 5 and lane_index in {0, 1, 2}:
                baseline_stock = 62 + lane_index * 10 + (medicine_index % 5) * 5
                reorder_level = 104 + lane_index * 8
                daily_consumption = 7 + ((medicine_index + lane_index) % 6) * 2
                expiry_window_days = 72 + ((medicine_index * 5 + lane_index * 11) % 120)

            days_remaining = max(2, baseline_stock // max(daily_consumption, 1))
            criticality_bonus = 8 if medicine["category"] in {"Critical Care", "Emergency", "Oncology", "Cardiology"} else 0
            shortage_risk = min(
                99,
                round(
                    32
                    + max(reorder_level - baseline_stock, 0) * 0.42
                    + daily_consumption * 1.7
                    + supplier["lead_time_days"] * 2.4
                    + criticality_bonus
                    + (18 if expiry_window_days < 30 else 0)
                    + (9 if medicine_index < 12 else 0),
                    1,
                ),
            )

            status = "healthy"
            if days_remaining < 7 or shortage_risk >= 88 or expiry_window_days < 21:
                status = "critical"
            elif days_remaining < 14 or shortage_risk >= 70 or expiry_window_days < 45:
                status = "watch"

            inventory.append(
                {
                    "id": next_id,
                    "medicine_code": f"{medicine['medicine_code']}-{lane_index + 1}",
                    "name": medicine["name"],
                    "category": medicine["category"],
                    "unit": medicine["unit"],
                    "supplier_code": supplier["supplier_code"],
                    "department_name": warehouse["department_name"],
                    "warehouse_name": warehouse["name"],
                    "stock_on_hand": baseline_stock,
                    "reorder_level": reorder_level,
                    "daily_consumption": daily_consumption,
                    "days_remaining": days_remaining,
                    "expiry_date": _iso_date(days=expiry_window_days),
                    "unit_cost": 18 + (medicine_index % 17) * 7 + lane_index,
                    "status": status,
                    "shortage_risk": shortage_risk,
                    "created_at": _iso_date(days=-10),
                }
            )
            next_id += 1

    return inventory


def create_forecasts() -> list[dict]:
    forecasts: list[dict] = []
    now = _now()

    for index in range(12):
        month_date = now - timedelta(days=(11 - index) * 30)
        forecasts.append(
            {
                "id": index + 1,
                "forecast_code": f"FC-{index + 1:03d}",
                "month": month_date.strftime("%b"),
                "consumption": 42000 + index * 2200 + (index % 4) * 880,
                "forecast": 43800 + index * 2350 + ((index + 1) % 5) * 910,
                "shortage_index": 34 + (index % 5) * 7 + (10 if index > 8 else 0),
                "created_at": _iso_date(days=-15 + index),
            }
        )

    return forecasts


def create_consumption_history(medicines: list[dict], departments: list[dict]) -> list[dict]:
    rows: list[dict] = []
    next_id = 1
    month_labels = [(datetime.now(UTC) - timedelta(days=month * 30)).strftime("%b %Y") for month in range(11, -1, -1)]

    for medicine_index, medicine in enumerate(medicines):
        department = departments[medicine_index % len(departments)]
        base_quantity = 180 + (medicine_index % 20) * 14
        for month_index, label in enumerate(month_labels):
            rows.append(
                {
                    "id": next_id,
                    "history_code": f"CON-{next_id:06d}",
                    "medicine_name": medicine["name"],
                    "department_name": department["name"],
                    "period_label": label,
                    "quantity": base_quantity + month_index * 9 + (month_index % 3) * 16,
                    "created_at": _iso_date(days=-330 + month_index * 30),
                }
            )
            next_id += 1

    return rows


def create_orders(medicines: list[dict], suppliers: list[dict], users: list[dict]) -> list[dict]:
    statuses = (
        ["pending-approval"] * 12
        + ["modified"] * 8
        + ["approved"] * 10
        + ["in-transit"] * 8
        + ["received"] * 8
        + ["rejected"] * 4
    )
    orders: list[dict] = []

    for index, status in enumerate(statuses):
        medicine = medicines[index % len(medicines)]
        supplier = suppliers[(index * 2) % len(suppliers)]
        requester = users[(index % 3) + 1]
        critical_category = medicine["category"] in {"Critical Care", "Emergency", "Oncology", "Cardiology"}
        priority = "critical" if index < 18 or critical_category else "warning" if index < 36 else "info"
        quantity = 120 + (index % 6) * 40 + (60 if priority == "critical" else 0)
        unit_cost = 45 + (index % 10) * 12 + (18 if critical_category else 0)
        eta = _iso_date(days=2 + (index % 5))
        if status == "in-transit":
            eta = _iso_date(days=1 + (index % 4))
        elif status == "received":
            eta = _iso_date(days=-(index % 3), hours=-(index % 6))
        orders.append(
            {
                "id": index + 1,
                "order_code": f"PO-{index + 1:04d}",
                "medicine_code": f"{medicine['medicine_code']}-1",
                "medicine_name": medicine["name"],
                "supplier_code": supplier["supplier_code"],
                "supplier_name": supplier["name"],
                "quantity": quantity,
                "unit_cost": unit_cost,
                "total_cost": quantity * unit_cost,
                "status": status,
                "requested_by": requester["full_name"],
                "created_at": _iso_date(hours=-(index * 6 + 2)),
                "eta": eta,
                "priority": priority,
            }
        )

    return orders


def create_approvals(orders: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for index, order in enumerate(orders):
        approval_status = order["status"] if order["status"] in {"pending-approval", "modified", "approved", "rejected"} else "approved"
        rows.append(
            {
                "id": index + 1,
                "approval_code": f"APR-{index + 1:04d}",
                "order_code": order["order_code"],
                "status": approval_status,
                "assigned_role": "Procurement Manager",
                "requested_by": order["requested_by"],
                "last_action_at": None if approval_status == "pending-approval" else _shift_iso(order["created_at"], hours=4),
                "created_at": order["created_at"],
            }
        )
    return rows


def create_approval_history(approvals: list[dict], orders: list[dict]) -> list[dict]:
    order_status_by_code = {order["order_code"]: order["status"] for order in orders}
    rows: list[dict] = []
    next_id = 1

    for approval in approvals:
        order_status = order_status_by_code[approval["order_code"]]
        entries = [
            {
                "action": "queued",
                "comment": "Awaiting procurement review.",
                "acted_by": approval["requested_by"],
                "acted_role": "Inventory Manager",
                "created_at": approval["created_at"],
            }
        ]

        if order_status == "modified":
            entries.append(
                {
                    "action": "modified",
                    "comment": "Quantity and ETA adjusted after supplier review.",
                    "acted_by": "Lavanya Iyer",
                    "acted_role": "Procurement Manager",
                    "created_at": _shift_iso(approval["created_at"], hours=3),
                }
            )
        elif order_status == "rejected":
            entries.append(
                {
                    "action": "rejected",
                    "comment": "Request rejected because near-expiry stock can be redistributed first.",
                    "acted_by": "Lavanya Iyer",
                    "acted_role": "Procurement Manager",
                    "created_at": _shift_iso(approval["created_at"], hours=3),
                }
            )
        else:
            if order_status != "pending-approval":
                entries.append(
                    {
                        "action": "approved",
                        "comment": "Approved for supplier release.",
                        "acted_by": "Lavanya Iyer",
                        "acted_role": "Procurement Manager",
                        "created_at": _shift_iso(approval["created_at"], hours=2),
                    }
                )
            if order_status == "in-transit":
                entries.append(
                    {
                        "action": "supplier-confirmed",
                        "comment": "Supplier dispatch confirmed and shipment is on the way.",
                        "acted_by": "Supplier Dispatch Desk",
                        "acted_role": "Supplier",
                        "created_at": _shift_iso(approval["created_at"], hours=8),
                    }
                )
            if order_status == "received":
                entries.append(
                    {
                        "action": "received",
                        "comment": "Delivery received at central pharmacy and posted to inventory.",
                        "acted_by": "Ritika Sharma",
                        "acted_role": "Inventory Manager",
                        "created_at": _shift_iso(approval["created_at"], days=1),
                    }
                )

        for entry in entries:
            rows.append(
                {
                    "id": next_id,
                    "history_code": f"APH-{next_id:04d}",
                    "approval_code": approval["approval_code"],
                    "action": entry["action"],
                    "comment": entry["comment"],
                    "acted_by": entry["acted_by"],
                    "acted_role": entry["acted_role"],
                    "created_at": entry["created_at"],
                }
            )
            next_id += 1

    return rows


def create_vendor_contracts(suppliers: list[dict]) -> list[dict]:
    return [
        {
            "id": index + 1,
            "contract_code": f"VND-{index + 1:04d}",
            "supplier_code": supplier["supplier_code"],
            "title": f"{supplier['name']} Annual Supply Agreement",
            "effective_from": _iso_date(days=-180),
            "effective_to": _iso_date(days=180),
            "created_at": _iso_date(days=-180 + index),
        }
        for index, supplier in enumerate(suppliers)
    ]


def create_invoices(orders: list[dict]) -> list[dict]:
    invoiced_orders = [order for order in orders if order["status"] in {"approved", "in-transit", "received"}][:30]
    rows: list[dict] = []

    for index, order in enumerate(invoiced_orders):
        invoice_status = "paid" if order["status"] == "received" else "approved" if order["status"] == "approved" else "pending"
        rows.append(
            {
                "id": index + 1,
                "invoice_code": f"INV-{index + 1:05d}",
                "order_code": order["order_code"],
                "supplier_code": order["supplier_code"],
                "amount": round(order["total_cost"] * 1.05, 2),
                "status": invoice_status,
                "issued_at": _shift_iso(order["created_at"], days=1),
                "created_at": _shift_iso(order["created_at"], days=1),
            }
        )

    return rows


def create_alerts(inventory: list[dict], orders: list[dict]) -> list[dict]:
    sources = ["Inventory", "Forecast", "Procurement", "Compliance", "Supplier", "Agent"]
    ranked_inventory = sorted(inventory, key=lambda item: item["shortage_risk"], reverse=True)
    unique_inventory: list[dict] = []
    seen_medicines: set[str] = set()
    for item in ranked_inventory:
        if item["name"] in seen_medicines:
            continue
        seen_medicines.add(item["name"])
        unique_inventory.append(item)
        if len(unique_inventory) == 30:
            break

    alerts: list[dict] = []

    for index in range(min(30, len(unique_inventory), len(orders))):
        item = unique_inventory[index]
        order = orders[index]
        source = sources[index % len(sources)]
        severity = "critical" if index < 10 else "warning" if index < 22 else "info"
        status = "resolved" if index in {8, 17, 24, 29} else "open"

        if source == "Inventory":
            title = f"{item['name']} below safe-stock threshold"
            description = f"{item['name']} has only {item['days_remaining']} days of cover remaining across active storage lanes."
        elif source == "Forecast":
            title = f"{item['name']} shortage risk rising in 7-day forecast"
            description = f"Projected demand is outpacing current replenishment posture for {item['name']} in the next planning window."
        elif source == "Procurement":
            title = f"{order['medicine_name']} approval delay is blocking replenishment"
            description = f"{order['order_code']} remains in {order['status']} state and is delaying restock for {order['medicine_name']}."
        elif source == "Compliance":
            title = f"{item['name']} near-expiry batches require redistribution"
            description = f"{item['name']} has batches approaching expiry and should be rebalanced before fresh procurement is released."
        elif source == "Supplier":
            title = f"{order['supplier_name']} delivery variance detected"
            description = f"Lead-time variance from {order['supplier_name']} is increasing continuity risk for {order['medicine_name']}."
        else:
            title = f"MediIntel raised an escalation for {item['name']}"
            description = f"Agent review recommends priority action for {item['name']} because operational signals converged on the same risk pattern."

        alerts.append(
            {
                "id": index + 1,
                "alert_code": f"ALT-{index + 1:03d}",
                "title": title,
                "description": description,
                "severity": severity,
                "source": source,
                "event_time": _iso_date(hours=-(index * 2 + 1)),
                "status": status,
                "medicine_name": item["name"],
            }
        )

    return alerts


def _policy_file_content(file_record: dict) -> str:
    filename = file_record["filename"]
    category = file_record["category"]

    content_map = {
        "Hospital_SOP_Procurement_v3.pdf": """
CityCare Multi-Speciality Hospital Procurement SOP

1. Review all critical medicines at 08:00 and 18:00 daily.
2. Raise a procurement request whenever projected days of cover fall below seven days or forecast variance exceeds fifteen percent.
3. Inventory Manager validates stock on hand, open orders, and near-expiry exposure before submission.
4. Procurement Manager approves emergency sourcing for ICU, Emergency, Oncology, and Cardiology medicines within four business hours.
5. Alternate suppliers must be evaluated whenever primary supplier lead time exceeds five days or fill rate drops below ninety percent.
6. Any purchase above INR 250,000 requires approval trail capture and audit logging in MediIntel.
7. Supplier notifications must include delivery window, cold-chain handling, and substitution restrictions.
""",
        "Inventory_Policy_Cold_Chain.pdf": """
Cold Chain Inventory Policy

Critical refrigerated medicines must remain between two and eight degrees Celsius at every storage point.
Stock transfers between Pharmacy, ICU, and Emergency require temperature log validation and batch traceability.
If temperature excursion exceeds thirty minutes, quarantine affected batches and notify Pharmacy Manager immediately.
Safety stock for cold-chain medicines must cover ten days of projected consumption plus one supplier lead-time cycle.
Near-expiry lots inside sixty days must be redistributed before any new procurement is approved.
""",
        "Supplier_Contracts_Master_2026.pdf": """
Supplier Contracts Master 2026

Primary strategic suppliers shall maintain a minimum fill rate of ninety-two percent and on-time delivery rate of ninety percent.
Emergency critical-care orders require dispatch confirmation within two hours and delivery inside twenty-four hours for Chennai metro locations.
Penalty clauses apply when backorder rate exceeds eight percent for two consecutive months.
Substitution of branded critical medicines is prohibited without written clinical validation from Pharmacy and Procurement.
Quarterly scorecards compare lead time, escalation responsiveness, invoice accuracy, and service recovery.
""",
        "Medicine_Catalogue_Critical_Care.xlsx": """
Critical Care Medicine Catalogue

Albumin 20 percent, Heparin Sodium, Meropenem 1g, Noradrenaline Injection, Adrenaline Injection, Human Immunoglobulin, Remdesivir 100mg, Dobutamine Injection.
Minimum buffer policy for ICU and Emergency requires fourteen days of cover for vasopressors and ten days for broad-spectrum antibiotics.
Any item with daily consumption above twelve units is monitored twice daily for projected shortage risk and pending replenishment status.
Clinical substitutions are allowed only when therapeutic class and dosage equivalence are approved by Pharmacy.
""",
        "Procurement_Policy_Exception_Matrix.docx": """
Procurement Exception Matrix

Inventory Manager may raise emergency requests up to INR 100,000 when projected cover is below three days.
Procurement Manager may approve alternate supplier sourcing when cost delta is below eight percent and delivery improves by at least one day.
Admin approval is required when contract deviations exceed ten percent or when non-contracted suppliers are proposed.
All rejected requests must capture reason codes for pricing, duplicate demand, insufficient justification, or expiry risk.
Audit logs must record user, agent, action, supplier comparison, and final decision timestamp for every exception workflow.
""",
    }

    content = content_map.get(filename)
    if content:
        return content.strip()

    return (
        f"{filename}\n\n"
        f"{category} guidance for MediIntel knowledge retrieval.\n"
        "Review inventory risk, forecast exposure, supplier dependency, approval workflow, and audit traceability."
    )


def _policy_file_summary(file_record: dict) -> str:
    category = file_record["category"]
    summary_map = {
        "Hospital SOP": "Operational procurement SOP with shortage thresholds, approval windows, and supplier escalation steps.",
        "Inventory Policy": "Cold-chain handling and buffer policy for temperature-sensitive medicines.",
        "Supplier Contracts": "Contract performance obligations, emergency dispatch requirements, and penalty clauses.",
        "Medicine Catalogue": "Critical-care medicine list with safety stock and substitution governance notes.",
        "Procurement Policy": "Exception approval matrix for urgent procurement and supplier deviations.",
    }
    return summary_map.get(category, f"{category} document prepared for grounded MediIntel retrieval.")


def create_files(users: list[dict]) -> list[dict]:
    reference_data = load_reference_data()
    owner_cycle = [users[0]["full_name"], users[2]["full_name"], users[3]["full_name"]]
    return [
        {
            "id": index + 1,
            "file_code": f"FILE-{index + 1:03d}",
            "filename": file_record["filename"],
            "category": file_record["category"],
            "upload_date": _iso_date(hours=-24 * (index + 2)),
            "uploaded_by": owner_cycle[index % len(owner_cycle)],
            "status": "indexed",
            "size_label": f"{2.1 + index * 0.8:.1f} MB",
            "summary": _policy_file_summary(file_record),
            "download_content": _policy_file_content(file_record),
        }
        for index, file_record in enumerate(reference_data.get("policyFiles", []))
    ]


def create_apis() -> list[dict]:
    reference_data = load_reference_data()
    api_statuses = ["healthy", "healthy", "healthy", "healthy", "degraded", "offline"]
    return [
        {
            "id": index + 1,
            "api_code": f"API-{index + 1:03d}",
            "name": api_record["name"],
            "endpoint": api_record["endpoint"],
            "method": api_record["method"],
            "status": api_statuses[index % len(api_statuses)],
            "authentication": api_record["authentication"],
            "description": api_record["description"],
            "latency_ms": 82 + index * 17,
            "last_checked_at": _iso_date(hours=-(index + 1)),
        }
        for index, api_record in enumerate(reference_data.get("apiDefinitions", []))
    ]


def create_audit_logs(users: list[dict], orders: list[dict], alerts: list[dict]) -> list[dict]:
    actions = [
        (
            "Operations Agent",
            "inventory.read",
            "Inventory continuity review completed",
            "completed",
            "Inventory",
            orders[0]["medicine_code"],
            "High-risk medicines were scanned across ICU, Emergency, Pharmacy, and Oncology.",
        ),
        (
            "Intelligence Agent",
            "forecast.read",
            "Seven-day demand forecast recalculated",
            "completed",
            "Forecast",
            "FC-012",
            "Shortage prediction was refreshed using current consumption and supplier lead time.",
        ),
        (
            "Decision Agent",
            "recommendation.generate",
            "Supplier comparison escalated for critical medicine",
            "attention",
            "Order",
            orders[3]["order_code"],
            "Alternate supplier review is required because the primary lane is exposed to delay.",
        ),
        (
            "Action Agent",
            "purchase_order.generate",
            "Procurement request awaiting approval",
            "pending",
            "Order",
            orders[0]["order_code"],
            "Emergency replenishment was generated and routed into the approval queue.",
        ),
        (
            "Procurement Agent",
            "approval.approve",
            "Approval returned with modifications",
            "modified",
            "Order",
            orders[14]["order_code"],
            "Quantity and ETA were revised to align with supplier commitment.",
        ),
        (
            "Procurement Agent",
            "approval.reject",
            "Duplicate replenishment request rejected",
            "rejected",
            "Order",
            orders[-1]["order_code"],
            "The request was rejected because existing stock can cover demand after redistribution.",
        ),
        (
            "Alert Monitor",
            "inventory.read",
            "Critical alert triaged",
            "running",
            "Alert",
            alerts[0]["alert_code"],
            "Alert is still being reviewed with pharmacy and procurement stakeholders.",
        ),
    ]

    rows: list[dict] = []
    for index in range(36):
        agent, tool, action, status, entity_type, entity_id, detail = actions[index % len(actions)]
        actor = users[index % len(users)]
        rows.append(
            {
                "id": index + 1,
                "event_code": f"AUD-{index + 1:04d}",
                "actor": actor["full_name"],
                "user_role": actor["role"],
                "agent": agent,
                "tool": tool,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "status": status,
                "execution_time_ms": 420 + index * 18,
                "ip_address": "127.0.0.1",
                "metadata": {"source": "seed", "detail": detail},
                "created_at": _iso_date(hours=-(index + 1)),
            }
        )
    return rows


def create_seed_dataset() -> dict:
    hospitals = create_hospitals()
    roles = create_roles()
    permissions = create_permissions()
    role_permissions = create_role_permissions(roles, permissions)
    departments = create_departments()
    warehouses = create_warehouses(departments)
    medicines = create_medicines()
    users = create_users()
    suppliers = create_suppliers()
    inventory = create_inventory(medicines, suppliers, departments, warehouses)
    forecasts = create_forecasts()
    orders = create_orders(medicines, suppliers, users)
    approvals = create_approvals(orders)
    alerts = create_alerts(inventory, orders)
    dataset = {
        "hospitals": hospitals,
        "roles": roles,
        "permissions": permissions,
        "role_permissions": role_permissions,
        "departments": departments,
        "warehouses": warehouses,
        "medicines": medicines,
        "users": users,
        "suppliers": suppliers,
        "inventory": inventory,
        "forecasts": forecasts,
        "consumption_history": create_consumption_history(medicines, departments),
        "orders": orders,
        "approvals": approvals,
        "approval_history": create_approval_history(approvals, orders),
        "vendor_contracts": create_vendor_contracts(suppliers),
        "invoices": create_invoices(orders),
        "alerts": alerts,
        "files": create_files(users),
        "apis": create_apis(),
        "audit_logs": create_audit_logs(users, orders, alerts),
        "chat_sessions": [],
        "chat_history": [],
    }
    return deepcopy(dataset)
