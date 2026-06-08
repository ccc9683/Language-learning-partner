import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import APIConnectionError, APIStatusError, AsyncOpenAI

from .routers.say_it import router as say_it_router
from .schemas import TranslateRequest, TranslateResponse

load_dotenv()

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

app.include_router(say_it_router)


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
                    "Classify the input as kind='term' for a single English word "
                    "or short phrase, otherwise kind='text'. Return only valid JSON "
                    "with keys: kind, chinese, ipa, part_of_speech. "
                    "For kind='term', include concise Chinese meanings, IPA if known, "
                    "and part_of_speech in Chinese. For kind='text', include the Chinese "
                    "translation and set ipa and part_of_speech to null."
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
        return TranslateResponse(
            kind=parsed["kind"],
            chinese=parsed["chinese"],
            ipa=parsed.get("ipa"),
            part_of_speech=parsed.get("part_of_speech"),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="DeepSeek returned an unexpected response format.",
        ) from exc
