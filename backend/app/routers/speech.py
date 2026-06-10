from fastapi import APIRouter, Request

from ..schemas.speech import SpeechTranscribeResponse
from ..services.speech_service import transcribe_audio

router = APIRouter(prefix="/api/speech", tags=["speech"])


@router.post("/transcribe", response_model=SpeechTranscribeResponse)
async def transcribe(request: Request) -> SpeechTranscribeResponse:
    audio_bytes = await request.body()
    text = await transcribe_audio(
        audio_bytes=audio_bytes,
        content_type=request.headers.get("content-type", ""),
    )

    return SpeechTranscribeResponse(text=text)
