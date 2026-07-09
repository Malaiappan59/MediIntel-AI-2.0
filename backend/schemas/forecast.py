from pydantic import BaseModel


class ForecastPointResponse(BaseModel):
    id: str
    month: str
    consumption: int
    forecast: int
    shortage_index: float

