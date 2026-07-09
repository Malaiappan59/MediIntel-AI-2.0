from pydantic import BaseModel

from backend.schemas.alerts import AlertResponse
from backend.schemas.inventory import InventoryItemResponse
from backend.schemas.orders import ProcurementOrderResponse


class DashboardMetric(BaseModel):
    label: str
    value: str
    delta: str
    tone: str


class ProcurementActivity(BaseModel):
    id: str
    title: str
    detail: str
    timestamp: str
    category: str


class DashboardResponse(BaseModel):
    welcome_message: str
    current_mission: str
    hospital_health_score: float
    metrics: list[DashboardMetric]
    critical_medicines: list[InventoryItemResponse]
    latest_orders: list[ProcurementOrderResponse]
    critical_alerts: list[AlertResponse]
    procurement_activity: list[ProcurementActivity]

