from pydantic import BaseModel, Field, field_validator


class MasterAgentLaunchRequest(BaseModel):
    goal: str = Field(default="Prevent medicine shortages before they impact patient care.", max_length=400)

    @field_validator("goal")
    @classmethod
    def normalize_goal(cls, value: str) -> str:
        normalized = " ".join(value.split())
        return normalized or "Prevent medicine shortages before they impact patient care."


class AgentStageResponse(BaseModel):
    id: str
    title: str
    subtitle: str
    status: str
    summary: str


class AgentTimelineResponse(BaseModel):
    id: str
    title: str
    detail: str
    status: str
    timestamp: str


class MasterAgentResponse(BaseModel):
    id: str
    goal: str
    launched_at: str
    confidence_score: float
    reasoning: str
    next_action: str
    stages: list[AgentStageResponse]
    timeline: list[AgentTimelineResponse]
