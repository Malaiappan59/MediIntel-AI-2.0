from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.entities import Alert
from backend.services.erp_queries import list_alerts


class AlertService:
    def list_alerts(self, db: Session) -> list[dict]:
        return list_alerts(db)

    def resolve_alert(self, db: Session, alert_code: str) -> dict | None:
        alert = db.scalar(select(Alert).where(Alert.alert_code == alert_code))
        if alert is None:
            return None

        alert.status = "resolved"
        db.commit()
        db.refresh(alert)
        return {
            "id": alert.alert_code,
            "title": alert.title,
            "description": alert.description,
            "severity": alert.severity,
            "source": alert.source,
            "time": alert.event_time.isoformat(),
            "status": alert.status,
            "medicine_name": alert.medicine_name,
        }


alert_service = AlertService()
