from pydantic import BaseModel, Field

from backend.schemas.orders import ProcurementOrderResponse


class ApprovalActionRequest(BaseModel):
    order_id: str = Field(..., min_length=2)


class ApprovalQueueResponse(ProcurementOrderResponse):
    pass
