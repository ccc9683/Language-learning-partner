from fastapi import APIRouter

from ..schemas.say_it import SayItRequest, SayItResponse
from ..services.say_it_service import process_say_it

router = APIRouter(prefix="/api/say-it", tags=["say-it"])


@router.post("", response_model=SayItResponse)
async def say_it(payload: SayItRequest) -> SayItResponse:
    return await process_say_it(payload)
