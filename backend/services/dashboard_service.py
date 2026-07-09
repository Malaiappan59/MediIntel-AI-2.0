from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser
from backend.services.erp_queries import get_hospital_profile, list_alerts, list_inventory_items, list_orders


class DashboardService:
    def get_dashboard(self, db: Session, current_user: CurrentUser) -> dict:
        hospital = get_hospital_profile(db)
        inventory = list_inventory_items(db)
        orders = list_orders(db, limit=8)
        alerts = list_alerts(db, only_open=True, limit=6)

        critical_medicines = [item for item in inventory if item["status"] == "critical"][:5]
        predicted_shortages = [item for item in inventory if item["shortage_risk"] >= 78]
        pending_approvals = [order for order in orders if order["status"] in {"pending-approval", "modified"}]
        weighted_inventory_health = max(
            54.0,
            round(
                98
                - len(critical_medicines) * 1.7
                - len(predicted_shortages) * 0.18
                - len([item for item in inventory if item["days_remaining"] < 10]) * 0.05,
                1,
            ),
        )

        return {
            "welcome_message": f"Hello {current_user.full_name}",
            "current_mission": hospital["mission"],
            "hospital_health_score": weighted_inventory_health,
            "metrics": [
                {"label": "Critical Medicines", "value": str(len(critical_medicines)), "delta": "Operationally critical today", "tone": "rose"},
                {"label": "Predicted Shortages", "value": str(len(predicted_shortages)), "delta": "Next 7 days", "tone": "amber"},
                {"label": "Pending Approvals", "value": str(len(pending_approvals)), "delta": "Awaiting procurement action", "tone": "sky"},
                {"label": "Inventory Health", "value": f"{weighted_inventory_health}%", "delta": "Weighted continuity score", "tone": "emerald"},
            ],
            "critical_medicines": critical_medicines,
            "latest_orders": orders[:6],
            "critical_alerts": alerts[:5],
            "procurement_activity": [
                {
                    "id": order["id"],
                    "title": f"{order['medicine_name']} with {order['supplier_name']}",
                    "detail": f"{order['quantity']} units | {order['status']} | Rs {order['total_cost']:,}",
                    "timestamp": order["created_at"],
                    "category": "Procurement",
                }
                for order in orders[:6]
            ],
        }


dashboard_service = DashboardService()
