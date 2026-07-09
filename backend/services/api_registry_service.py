from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.entities import ApiRegistry
from backend.schemas.api_registry import ApiCreateRequest
from backend.services.erp_queries import list_apis


class ApiRegistryService:
    def list_apis(self, db: Session) -> list[dict]:
        return list_apis(db)

    def create_api(self, db: Session, payload: ApiCreateRequest) -> dict:
        next_id = db.scalar(select(func.count()).select_from(ApiRegistry)) or 0
        api_code = f"API-{next_id + 1:03d}"
        record = ApiRegistry(
            api_code=api_code,
            name=payload.name,
            endpoint=payload.endpoint,
            method=payload.method,
            status="healthy",
            authentication=payload.authentication,
            description=payload.description,
            latency_ms=96,
            last_checked_at=datetime.now(UTC),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {
            "id": record.api_code,
            "name": record.name,
            "endpoint": record.endpoint,
            "method": record.method,
            "status": record.status,
            "authentication": record.authentication,
            "description": record.description,
            "latency_ms": record.latency_ms,
            "last_checked_at": record.last_checked_at.isoformat(),
        }

    def delete_api(self, db: Session, api_code: str) -> bool:
        record = db.scalar(select(ApiRegistry).where(ApiRegistry.api_code == api_code))
        if record is None:
            return False

        db.delete(record)
        db.commit()
        return True


api_registry_service = ApiRegistryService()
