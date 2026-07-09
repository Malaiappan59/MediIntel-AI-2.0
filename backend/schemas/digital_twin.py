from pydantic import BaseModel


class HospitalProfileResponse(BaseModel):
    name: str
    tagline: str
    location: str
    mission: str
    beds: int
    departments: list[str]


class DigitalTwinStateResponse(BaseModel):
    inventory_health: float
    critical_medicines: int
    predicted_shortages: int
    pending_approvals: int
    open_alerts: int


class DigitalTwinResponse(BaseModel):
    hospital: HospitalProfileResponse
    live_state: DigitalTwinStateResponse
