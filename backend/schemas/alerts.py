from pydantic import BaseModel


class AlertResolveRequest(BaseModel):
    status: str = "resolved"


class AlertResponse(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    source: str
    time: str
    status: str
    medicine_name: str | None = None

