import json
import os
import re

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import APIConnectionError, APIStatusError, AsyncOpenAI
from pydantic import ValidationError

from .db import init_db
from .routers.learning_book import router as learning_book_router
from .routers.partner import router as partner_router
from .routers.say_it import router as say_it_router
from .routers.speech import router as speech_router
from .schemas import TranslateRequest, TranslateResponse
from .schemas.translator import TranslateDetail

load_dotenv()
init_db()

app = FastAPI(title="LLP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(learning_book_router)
app.include_router(say_it_router)
app.include_router(partner_router)
app.include_router(speech_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/translate", response_model=TranslateResponse)
async def translate(payload: TranslateRequest) -> TranslateResponse:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    return await call_llm(text)


async def call_llm(text: str) -> TranslateResponse:
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
    model = os.getenv("LLM_MODEL", "deepseek-v4-flash")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="LLM_API_KEY must be set.",
        )

    request_body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an English-to-Chinese translation API. "
                    "Classify the input as kind='term' only for a single English word "
                    "or short English phrase. Classify English sentences, English "
                    "paragraphs, and any Chinese input as kind='text'. Return only valid "
                    "JSON with keys: kind, chinese, ipa, part_of_speech, detail. "
                    "For Chinese input, translate it to natural English in the chinese "
                    "field for backward compatibility. For kind='term', include concise "
                    "Chinese meanings, IPA if known, part_of_speech in Chinese, and a "
                    "detail object for English study. If the input is misspelled but the "
                    "intended word is clear, translate the corrected word and use the "
                    "correct headword in detail.headword. The detail object must contain: "
                    "headword, pos, meanings, usages, synonyms, common_mistakes. Keep it "
                    "short: 1-3 meanings, 1-3 common usage patterns with pattern, "
                    "example_en, and example_zh, 1-4 synonyms, and 0-2 common mistakes. "
                    "When kind='term', detail must be an object and must not be null. "
                    "When kind='text', detail must be null. Never include detail for full "
                    "sentences or Chinese-to-English translation. Example term JSON: "
                    '{"kind":"term","chinese":"考虑, 认为","ipa":"/kənˈsɪdər/",'
                    '"part_of_speech":"动词","detail":{"headword":"consider","pos":"v.",'
                    '"meanings":["考虑","认为"],"usages":[{"pattern":"consider doing sth",'
                    '"example_en":"I am considering changing jobs.",'
                    '"example_zh":"我正在考虑换工作。"}],"synonyms":["think about"],'
                    '"common_mistakes":[{"wrong":"consider to do","correct":"consider doing",'
                    '"note":"consider 后接动名词。"}]}}. Example text JSON: '
                    '{"kind":"text","chinese":"我正在考虑换工作。","ipa":null,'
                    '"part_of_speech":null,"detail":null}.'
                ),
            },
            {
                "role": "user",
                "content": text,
            },
        ],
    }

    client = AsyncOpenAI(api_key=api_key, base_url=base_url.rstrip("/"))

    try:
        completion = await client.chat.completions.create(**request_body)
    except APIStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"DeepSeek API error: {exc.response.text}",
        ) from exc
    except APIConnectionError as exc:
        raise HTTPException(status_code=502, detail=f"DeepSeek request failed: {exc}") from exc

    try:
        content = completion.choices[0].message.content
        if not content:
            raise ValueError("Empty LLM response.")
        parsed = json.loads(content)
        kind = parsed["kind"]
        return TranslateResponse(
            kind=kind,
            chinese=parsed["chinese"],
            ipa=parsed.get("ipa"),
            part_of_speech=parsed.get("part_of_speech"),
            detail=parse_detail(
                kind=kind,
                detail=parsed.get("detail"),
                source_text=text,
                chinese=parsed["chinese"],
                part_of_speech=parsed.get("part_of_speech"),
            ),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="DeepSeek returned an unexpected response format.",
        ) from exc


def parse_detail(
    kind: str,
    detail: object,
    source_text: str,
    chinese: str,
    part_of_speech: str | None,
) -> TranslateDetail | None:
    if kind != "term":
        return None

    detail_data = detail if isinstance(detail, dict) else {}

    if detail_data:
        try:
            return TranslateDetail(**detail_data)
        except ValidationError:
            pass

    return TranslateDetail(
        headword=extract_headword(detail_data, source_text),
        pos=part_of_speech,
        meanings=split_meanings(chinese),
        usages=[],
        synonyms=[],
        common_mistakes=[],
    )


def extract_headword(detail: dict[str, object], source_text: str) -> str:
    headword = detail.get("headword")
    if isinstance(headword, str) and headword.strip():
        return headword.strip()

    return source_text.strip()


def split_meanings(chinese: str) -> list[str]:
    meanings = [
        meaning.strip()
        for meaning in re.split(r"[,，;；、\n]+", chinese)
        if meaning.strip()
    ]

    return meanings or [chinese.strip()]
