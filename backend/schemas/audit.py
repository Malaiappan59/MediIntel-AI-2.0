from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    time: str
    agent: str
    action: str
    status: str
    user: str
    detail: str
    tool: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
