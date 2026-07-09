from fastapi import APIRouter

from backend.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def healthcheck() -> HealthResponse:
    return HealthResponse(
        service="medintel-backend",
        status="ok",
        details="Backend services are running.",
    )
