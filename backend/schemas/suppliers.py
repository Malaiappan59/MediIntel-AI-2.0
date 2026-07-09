from pydantic import BaseModel


class SupplierResponse(BaseModel):
    id: str
    name: str
    city: str
    specialty: str
    contact: str
    lead_time_days: int
    on_time_rate: float
    fulfillment_rate: float
