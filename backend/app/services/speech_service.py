import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import HTTPException

MAX_AUDIO_BYTES = 10 * 1024 * 1024
BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_STT_CACHE_DIR = BACKEND_DIR / "data" / "hf-cache"
_LOCAL_MODEL: Any | None = None


class LocalSpeechError(Exception):
    pass


async def transcribe_audio(audio_bytes: bytes, content_type: str) -> str:
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio data is required.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large.")

    suffix = audio_suffix(content_type)
    temp_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = Path(temp_file.name)

        text = transcribe_file(temp_path)
    except LocalSpeechError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)

    if not text.strip():
        raise HTTPException(status_code=502, detail="Local speech transcription returned empty text.")

    return text.strip()


def transcribe_file(audio_path: Path) -> str:
    model = get_local_model()
    language = clean_optional(os.getenv("LOCAL_STT_LANGUAGE"))
    beam_size = parse_int(os.getenv("LOCAL_STT_BEAM_SIZE"), default=1)

    try:
        segments, _info = model.transcribe(
            str(audio_path),
            language=language,
            beam_size=beam_size,
            vad_filter=True,
        )
        return " ".join(segment.text.strip() for segment in segments if segment.text.strip())
    except Exception as exc:
        raise LocalSpeechError(f"Local speech transcription failed: {exc}") from exc


def get_local_model() -> Any:
    global _LOCAL_MODEL

    if _LOCAL_MODEL is not None:
        return _LOCAL_MODEL

    try:
        cache_dir = Path(clean_optional(os.getenv("LOCAL_STT_CACHE_DIR")) or DEFAULT_STT_CACHE_DIR)
        cache_dir.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("HF_HOME", str(cache_dir))

        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise LocalSpeechError(
            "faster-whisper is not installed. Run `pip install -r backend/requirements.txt`."
        ) from exc

    model_name = os.getenv("LOCAL_STT_MODEL", "base")
    device = os.getenv("LOCAL_STT_DEVICE", "cpu")
    compute_type = os.getenv("LOCAL_STT_COMPUTE_TYPE", "int8")
    model_path = clean_optional(os.getenv("LOCAL_STT_MODEL_PATH"))
    model_size_or_path = model_path or model_name

    try:
        _LOCAL_MODEL = WhisperModel(
            model_size_or_path,
            device=device,
            compute_type=compute_type,
        )
    except Exception as exc:
        raise LocalSpeechError(f"Local speech model failed to load: {exc}") from exc

    return _LOCAL_MODEL


def clean_optional(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def parse_int(value: str | None, default: int) -> int:
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        return default


def audio_suffix(content_type: str) -> str:
    if "mp4" in content_type:
        return ".mp4"
    if "mpeg" in content_type or "mp3" in content_type:
        return ".mp3"
    if "wav" in content_type:
        return ".wav"

    return ".webm"
