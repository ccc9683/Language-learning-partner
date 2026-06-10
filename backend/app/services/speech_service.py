import os
import tempfile
from pathlib import Path

from fastapi import HTTPException
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

MAX_AUDIO_BYTES = 10 * 1024 * 1024


async def transcribe_audio(audio_bytes: bytes, content_type: str) -> str:
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio data is required.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large.")

    api_key = os.getenv("STT_API_KEY") or os.getenv("LLM_API_KEY")
    base_url = os.getenv("STT_BASE_URL")
    model = os.getenv("STT_MODEL", "whisper-1")

    if not api_key:
        raise HTTPException(
            status_code=501,
            detail="STT_API_KEY or LLM_API_KEY must be set for upload transcription.",
        )

    suffix = audio_suffix(content_type)
    temp_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = Path(temp_file.name)

        client_kwargs: dict[str, object] = {
            "api_key": api_key,
            "timeout": 30.0,
        }
        if base_url:
            client_kwargs["base_url"] = base_url.rstrip("/")

        client = AsyncOpenAI(**client_kwargs)

        with temp_path.open("rb") as audio_file:
            transcription = await client.audio.transcriptions.create(
                model=model,
                file=audio_file,
            )
    except APIStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Speech transcription API error: {exc.response.text}",
        ) from exc
    except (APIConnectionError, APITimeoutError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Speech transcription request failed: {exc}",
        ) from exc
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)

    text = getattr(transcription, "text", "")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=502, detail="Speech transcription returned empty text.")

    return text.strip()


def audio_suffix(content_type: str) -> str:
    if "mp4" in content_type:
        return ".mp4"
    if "mpeg" in content_type or "mp3" in content_type:
        return ".mp3"
    if "wav" in content_type:
        return ".wav"

    return ".webm"
