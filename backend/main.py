from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.approvals import router as approvals_router
from backend.routes.alerts import router as alerts_router
from backend.routes.apis import router as apis_router
from backend.routes.audit import router as audit_router
from backend.middleware.request_context import RequestContextMiddleware
from backend.routes.auth import router as auth_router
from backend.routes.chat import router as chat_router
from backend.routes.dashboard import router as dashboard_router
from backend.routes.digital_twin import router as digital_twin_router
from backend.routes.files import router as files_router
from backend.routes.forecast import router as forecast_router
from backend.routes.health import router as health_router
from backend.routes.inventory import router as inventory_router
from backend.routes.master_agent import router as master_agent_router
from backend.routes.orders import router as orders_router
from backend.routes.procurement import router as procurement_router
from backend.routes.suppliers import router as suppliers_router
from backend.utils.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate_runtime()
    for warning in settings.runtime_warnings():
        logger.warning("Runtime configuration warning: %s", warning)
    yield


app = FastAPI(
    title="MediIntel API",
    description="Enterprise healthcare backend scaffold",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(auth_router, prefix="/api/v1", tags=["Authentication"])
app.include_router(dashboard_router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(digital_twin_router, prefix="/api/v1", tags=["Digital Twin"])
app.include_router(suppliers_router, prefix="/api/v1", tags=["Suppliers"])
app.include_router(inventory_router, prefix="/api/v1", tags=["Inventory"])
app.include_router(forecast_router, prefix="/api/v1", tags=["Forecast"])
app.include_router(orders_router, prefix="/api/v1", tags=["Orders"])
app.include_router(procurement_router, prefix="/api/v1", tags=["Procurement"])
app.include_router(approvals_router, prefix="/api/v1", tags=["Approvals"])
app.include_router(alerts_router, prefix="/api/v1", tags=["Alerts"])
app.include_router(files_router, prefix="/api/v1", tags=["Files"])
app.include_router(apis_router, prefix="/api/v1", tags=["APIs"])
app.include_router(audit_router, prefix="/api/v1", tags=["Audit"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(master_agent_router, prefix="/api/v1", tags=["Master Agent"])


@app.get("/", tags=["Root"])
def read_root():
    return {
        "application": "MediIntel API",
        "status": "ok",
        "message": "Enterprise AI operations backend is running.",
    }
