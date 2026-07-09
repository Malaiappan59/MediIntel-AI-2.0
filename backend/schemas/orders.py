from pydantic import BaseModel, Field


class ProcurementOrderCreate(BaseModel):
    medicine_name: str = Field(..., min_length=2)
    supplier_name: str = Field(..., min_length=2)
    quantity: int = Field(..., gt=0)
    requested_by: str = Field(..., min_length=2)
    priority: str = Field(default="warning")
    medicine_code: str | None = None
    supplier_code: str | None = None
    unit_cost: float | None = Field(default=None, gt=0)
    eta_days: int | None = Field(default=None, gt=0)


class ProcurementGenerateRequest(BaseModel):
    medicine_id: str | None = None
    quantity: int | None = Field(default=None, gt=0)
    note: str | None = None


class ProcurementTraceResponse(BaseModel):
    approval_id: str | None = None
    approval_history_id: str | None = None
    audit_id: str | None = None
    assigned_role: str | None = None
    last_action: str | None = None
    last_action_at: str | None = None


class ProcurementOrderResponse(BaseModel):
    id: str
    medicine_id: str
    medicine_name: str
    supplier_id: str
    supplier_name: str
    quantity: int
    unit_cost: float
    total_cost: float
    status: str
    requested_by: str
    created_at: str
    eta: str
    priority: str
    trace: ProcurementTraceResponse | None = None
