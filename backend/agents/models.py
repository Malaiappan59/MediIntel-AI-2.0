from pydantic import BaseModel, Field


class MetricItem(BaseModel):
    label: str
    value: str
    tone: str = "sky"


class TableColumnItem(BaseModel):
    key: str
    label: str
    align: str | None = None


class TableItem(BaseModel):
    title: str
    columns: list[TableColumnItem]
    rows: list[dict[str, str | int | float]]


class ActionItem(BaseModel):
    id: str
    label: str
    prompt: str
    tone: str = "secondary"
    kind: str = "prompt"


class ContributionItem(BaseModel):
    id: str
    agent: str
    summary: str
    detail: str
    status: str = "completed"


class KnowledgeSourceItem(BaseModel):
    id: str
    filename: str
    category: str
    excerpt: str
    score: float | None = None
    strategy: str = "vector-search"


class SummaryBlock(BaseModel):
    headline: str = ""
    narrative: str = ""
    metrics: list[MetricItem] = Field(default_factory=list)


class ExecutionPlan(BaseModel):
    intent: str
    goal: str
    agents_required: list[str] = Field(default_factory=list)


class SpecialistResult(BaseModel):
    agent: str
    summary: str
    detail: str
    status: str = "completed"
    metrics: list[MetricItem] = Field(default_factory=list)
    table: TableItem | None = None
    recommendations: list[str] = Field(default_factory=list)
    sources: list[KnowledgeSourceItem] = Field(default_factory=list)


class WorkspaceReply(BaseModel):
    id: str = ""
    role: str = "assistant"
    user: str = ""
    intent: str = ""
    created_at: str = ""
    runtime_mode: str = "live"
    agents_used: list[str] = Field(default_factory=list)
    summary: SummaryBlock = Field(default_factory=SummaryBlock)
    tables: list[TableItem] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    actions: list[ActionItem] = Field(default_factory=list)
    confidence: float = 0
    reasoning: str = ""
    contributions: list[ContributionItem] = Field(default_factory=list)
    sources: list[KnowledgeSourceItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    audit_id: str = ""
