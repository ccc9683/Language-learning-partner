import pytest
from fastapi import HTTPException

from app.main import app
from app.services.speech_service import transcribe_audio


def test_speech_route_is_registered():
    route_paths = {route.path for route in app.routes}

    assert "/api/speech/transcribe" in route_paths


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_empty_audio():
    with pytest.raises(HTTPException) as exc_info:
        await transcribe_audio(b"", "audio/webm")

    assert exc_info.value.status_code == 400
