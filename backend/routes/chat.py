from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.agents.workspace import AIConfigurationError, AIExecutionError
from backend.schemas.chat import ChatHistoryResponse, ChatRequest, ChatResponse
from backend.services.chat_service import chat_service
from backend.services.erp_queries import list_chat_history

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> ChatResponse:
    try:
        return ChatResponse(
            **(
                await chat_service.respond(
                    db,
                    current_user,
                    payload,
                    ip_address=request.client.host if request.client else None,
                )
            )
        )
    except (AIConfigurationError, AIExecutionError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/chat/history", response_model=ChatHistoryResponse)
def chat_history(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> ChatHistoryResponse:
    return ChatHistoryResponse(history=list_chat_history(db, username=current_user.username, limit=50))
