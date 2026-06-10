from fastapi import APIRouter, HTTPException, Query

from ..schemas.partner import (
    PartnerChatRequest,
    PartnerChatResponse,
    PartnerClearMemoryResponse,
    PartnerHistoryResponse,
    PartnerOkResponse,
)
from ..services.partner_service import (
    chat,
    clear_history,
    clear_memory,
    get_history,
)

router = APIRouter(prefix="/api/partner", tags=["partner"])


@router.get("/history", response_model=PartnerHistoryResponse)
async def history(limit: int = Query(default=30, ge=1, le=100)) -> PartnerHistoryResponse:
    messages, memory = get_history(limit=limit)
    return PartnerHistoryResponse(messages=messages, memory=memory)


@router.post("/chat", response_model=PartnerChatResponse)
async def partner_chat(payload: PartnerChatRequest) -> PartnerChatResponse:
    try:
        reply, memory = await chat(payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return PartnerChatResponse(reply=reply, updated_memory=memory)


@router.post("/clear-history", response_model=PartnerOkResponse)
async def clear_partner_history() -> PartnerOkResponse:
    clear_history()
    return PartnerOkResponse(ok=True)


@router.post("/clear-memory", response_model=PartnerClearMemoryResponse)
async def clear_partner_memory() -> PartnerClearMemoryResponse:
    memory = clear_memory()
    return PartnerClearMemoryResponse(ok=True, memory=memory)
