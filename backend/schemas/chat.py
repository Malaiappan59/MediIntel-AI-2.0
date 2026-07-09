from pydantic import BaseModel, Field, field_validator

from backend.agents.models import ActionItem, ContributionItem, KnowledgeSourceItem, MetricItem, SummaryBlock, TableItem
from backend.schemas.master_agent import MasterAgentResponse


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=2000)

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Message must contain at least two visible characters.")
        return normalized


class ChatHistoryMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    confidence: float | None = None
    reasoning: str | None = None
    structured_payload: dict | None = None


class ChatReplyResponse(BaseModel):
    id: str
    role: str
    user: str
    intent: str
    created_at: str
    runtime_mode: str = "live"
    agents_used: list[str]
    summary: SummaryBlock
    tables: list[TableItem]
    recommendations: list[str]
    actions: list[ActionItem]
    confidence: float
    reasoning: str
    contributions: list[ContributionItem]
    sources: list[KnowledgeSourceItem]
    warnings: list[str] = Field(default_factory=list)
    audit_id: str
    execution: MasterAgentResponse


class ChatResponse(BaseModel):
    reply: ChatReplyResponse
    history: list[ChatHistoryMessageResponse]


class ChatHistoryResponse(BaseModel):
    history: list[ChatHistoryMessageResponse]
