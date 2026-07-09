from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.master_agent import MasterAgentLaunchRequest, MasterAgentResponse
from backend.services.master_agent_service import master_agent_service

router = APIRouter()


@router.post("/master-agent/launch", response_model=MasterAgentResponse)
def launch_master_agent(
    payload: MasterAgentLaunchRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> MasterAgentResponse:
    return MasterAgentResponse(**master_agent_service.launch(db, current_user, payload))
