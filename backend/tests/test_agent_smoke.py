import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.agents.models import ActionItem, ContributionItem, ExecutionPlan, SummaryBlock, WorkspaceReply
from backend.agents.workspace import AIConfigurationError, workspace_agent_service
from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.base import Base
from backend.database.session import get_db_session
from backend.main import app
from backend.models.entities import Alert, AuditLog, FileRecord, Hospital, Inventory, Order


class AgentSmokeTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(self.engine)
        self._seed_operational_data()

        def override_get_db_session():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        def override_get_current_user() -> CurrentUser:
            return CurrentUser(
                id=1,
                username="smoke.admin",
                full_name="Smoke Tester",
                email="smoke.tester@citycarehospital.org",
                role="Admin",
                permissions=["inventory.read", "forecast.read", "recommendation.generate", "purchase_order.generate"],
                session_id="SES-SMOKE-001",
            )

        app.dependency_overrides[get_db_session] = override_get_db_session
        app.dependency_overrides[get_current_user] = override_get_current_user
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed_operational_data(self) -> None:
        session = self.SessionLocal()
        now = datetime.now(UTC)

        session.add(
            Hospital(
                hospital_code="HSP-TEST",
                name="CityCare Multi-Speciality Hospital",
                tagline="Predict. Prevent. Procure.",
                location="Chennai, India",
                mission="Prevent medicine shortages before they impact patient care.",
                beds=420,
                created_at=now - timedelta(days=365),
            )
        )
        session.add_all(
            [
                Inventory(
                    medicine_code="MED-TEST-001",
                    name="Platelet Concentrate",
                    category="Transfusion",
                    unit="bag",
                    supplier_code="SUP-001",
                    department_name="ICU",
                    warehouse_name="ICU Central Store",
                    stock_on_hand=28,
                    reorder_level=80,
                    daily_consumption=9,
                    days_remaining=3,
                    expiry_date=now + timedelta(days=12),
                    unit_cost=1800,
                    status="critical",
                    shortage_risk=92,
                    created_at=now - timedelta(days=10),
                ),
                Inventory(
                    medicine_code="MED-TEST-002",
                    name="Meropenem",
                    category="Antibiotic",
                    unit="vial",
                    supplier_code="SUP-002",
                    department_name="Emergency",
                    warehouse_name="Emergency Store",
                    stock_on_hand=74,
                    reorder_level=90,
                    daily_consumption=11,
                    days_remaining=6,
                    expiry_date=now + timedelta(days=30),
                    unit_cost=520,
                    status="watch",
                    shortage_risk=79,
                    created_at=now - timedelta(days=9),
                ),
            ]
        )
        session.add(
            Order(
                order_code="PO-TEST-001",
                medicine_code="MED-TEST-001",
                medicine_name="Platelet Concentrate",
                supplier_code="SUP-001",
                supplier_name="Apex Lifecare",
                quantity=120,
                unit_cost=1800,
                total_cost=216000,
                status="pending-approval",
                requested_by="Smoke Tester",
                created_at=now - timedelta(hours=2),
                eta=now + timedelta(days=2),
                priority="critical",
            )
        )
        session.add(
            Alert(
                alert_code="ALT-TEST-001",
                title="Platelet Concentrate requires urgent review",
                description="Inventory is below the recommended continuity buffer.",
                severity="critical",
                source="Inventory",
                event_time=now - timedelta(hours=1),
                status="open",
                medicine_name="Platelet Concentrate",
            )
        )
        session.add(
            FileRecord(
                file_code="FILE-TEST-001",
                filename="Hospital_Inventory_SOP.pdf",
                category="Hospital SOP",
                upload_date=now - timedelta(days=2),
                uploaded_by="Smoke Tester",
                status="indexed",
                size_label="2.8 MB",
                summary="Continuity SOP for blood products and critical inventory review.",
                download_content=(
                    "Platelet Concentrate continuity protocol. Escalate shortages within 4 hours and route emergency procurement "
                    "through the procurement command lane."
                ),
            )
        )
        session.commit()
        session.close()

    async def _fake_live_workspace_reply(self, current_user: CurrentUser, message: str):
        reply = WorkspaceReply(
            id="CHAT-LIVE-001",
            role="assistant",
            user=current_user.full_name,
            intent="inventory_review",
            created_at=datetime.now(UTC).isoformat(),
            runtime_mode="live",
            agents_used=["Inventory Agent", "Forecast Agent"],
            summary=SummaryBlock(
                headline="Inventory posture reviewed",
                narrative="Platelet Concentrate remains the most urgent continuity risk in the current operational window.",
                metrics=[],
            ),
            recommendations=["Review the urgent replenishment path for Platelet Concentrate."],
            actions=[ActionItem(id="check-inventory", label="Check Inventory", prompt="Check Inventory", tone="primary")],
            confidence=91,
            reasoning="Validated by the mocked smoke-test agent runtime.",
            contributions=[
                ContributionItem(
                    id="contribution-1",
                    agent="Inventory Agent",
                    summary="Inventory scan completed.",
                    detail=f"Request processed for: {message}",
                    status="completed",
                )
            ],
            warnings=[],
        )
        plan = ExecutionPlan(intent="inventory_review", goal="Review current inventory posture", agents_required=["Inventory Agent", "Forecast Agent"])
        return reply, plan, 321

    def test_master_agent_launch_route_smoke(self) -> None:
        response = self.client.post(
            "/api/v1/master-agent/launch",
            json={"goal": "Prevent platelet shortages in the ICU this week."},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["goal"], "Prevent platelet shortages in the ICU this week.")
        self.assertEqual(len(payload["stages"]), 5)
        self.assertEqual(payload["stages"][0]["title"], "Master Agent")

        session = self.SessionLocal()
        try:
            audit_log = session.scalar(select(AuditLog).where(AuditLog.tool == "workspace.launch"))
            self.assertIsNotNone(audit_log)
        finally:
            session.close()

    def test_chat_route_smoke_with_live_workspace_mock(self) -> None:
        with patch.object(workspace_agent_service, "run_workspace_query", new=AsyncMock(side_effect=self._fake_live_workspace_reply)):
            response = self.client.post("/api/v1/chat", json={"message": "Check ICU inventory status"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["reply"]["runtime_mode"], "live")
        self.assertEqual(payload["reply"]["id"], "CHAT-LIVE-001")
        self.assertTrue(payload["reply"]["audit_id"].startswith("AUD-"))
        self.assertEqual(len(payload["history"]), 2)

    def test_chat_route_returns_503_when_live_ai_configuration_is_missing_and_redacts_audit_detail(self) -> None:
        failing_message = (
            "Check platelet shortage for patient.johnson@citycarehospital.org "
            "MRN 12345678, supplier reference 87654321, and call +1 (555) 123-4567."
        )

        with patch.object(
            workspace_agent_service,
            "run_workspace_query",
            new=AsyncMock(side_effect=AIConfigurationError("OPENAI_API_KEY is not configured for MediIntel AI.")),
        ):
            response = self.client.post("/api/v1/chat", json={"message": failing_message})

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["detail"], "OPENAI_API_KEY is not configured for MediIntel AI.")

        session = self.SessionLocal()
        try:
            audit_log = session.scalar(
                select(AuditLog)
                .where(AuditLog.tool == "workspace.chat")
                .order_by(AuditLog.created_at.desc())
            )
            self.assertIsNone(audit_log)
        finally:
            session.close()


if __name__ == "__main__":
    unittest.main()
