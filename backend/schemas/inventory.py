from pydantic import BaseModel


class InventoryItemResponse(BaseModel):
    id: str
    name: str
    category: str
    unit: str
    supplier_id: str
    stock_on_hand: int
    reorder_level: int
    daily_consumption: int
    days_remaining: int
    expiry_date: str
    unit_cost: float
    status: str
    shortage_risk: float

