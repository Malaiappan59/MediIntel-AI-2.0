from pydantic import BaseModel, Field


class ApiCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    endpoint: str = Field(..., min_length=2)
    method: str = Field(..., min_length=2)
    authentication: str = Field(..., min_length=2)
    description: str = Field(..., min_length=5)


class ApiResponse(BaseModel):
    id: str
    name: str
    endpoint: str
    method: str
    status: str
    authentication: str
    description: str
    latency_ms: int
    last_checked_at: str

