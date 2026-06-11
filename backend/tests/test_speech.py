import pytest
from fastapi import HTTPException

from app.main import app
from app.services import speech_service
from app.services.speech_service import transcribe_audio


def test_speech_route_is_registered():
    route_paths = {route.path for route in app.routes}

    assert "/api/speech/transcribe" in route_paths


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_empty_audio():
    with pytest.raises(HTTPException) as exc_info:
        await transcribe_audio(b"", "audio/webm")

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_transcribe_audio_uses_local_transcriber(monkeypatch: pytest.MonkeyPatch):
    seen: dict[str, str] = {}

    def fake_transcribe_file(audio_path):
        seen["suffix"] = audio_path.suffix
        seen["exists"] = str(audio_path.exists())
        return "hello world"

    monkeypatch.setattr(speech_service, "transcribe_file", fake_transcribe_file)

    text = await transcribe_audio(b"fake-audio", "audio/webm")

    assert text == "hello world"
    assert seen == {"suffix": ".webm", "exists": "True"}
