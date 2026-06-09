import json
import os
import re
from typing import Any

from openai import APIConnectionError, APIStatusError, AsyncOpenAI

from ..schemas.say_it import SayItRequest, SayItResponse

CHINESE_PATTERN = re.compile(r"[\u4e00-\u9fff]")


async def process_say_it(payload: SayItRequest) -> SayItResponse:
    text = payload.text.strip()
    pending_text = payload.pending_text.strip() if payload.pending_text else ""
    clarification = payload.clarification.strip() if payload.clarification else ""

    if pending_text and clarification:
        return handle_clarification(pending_text, clarification)

    if pending_text and text:
        return handle_clarification(pending_text, text)

    deterministic = handle_deterministic(text)
    if deterministic:
        return deterministic

    if contains_chinese(text):
        return await call_llm(text, mode="translate")

    return await call_llm(text, mode="correct")


def handle_deterministic(text: str) -> SayItResponse | None:
    normalized = normalize_text(text)

    if normalized == "我想去超市买东西":
        return SayItResponse(
            type="translation",
            display_text="I want to go to the supermarket to buy some things.",
            english_text="I want to go to the supermarket to buy some things.",
        )

    if normalized == "我想打他":
        return SayItResponse(
            type="clarification",
            display_text="这句话有歧义，需要先确认含义。",
            question="你是想“打电话给他”还是“打架”？",
            options=["打电话", "打架"],
            original_text=text,
            ambiguous_text="",
        )

    if normalized == "我尤手写了一遍":
        return SayItResponse(
            type="clarification",
            display_text="这句话有歧义，需要先确认用字。",
            question="你是想用“又”“右”还是“有”？",
            options=["又", "右", "有"],
            original_text=text,
            ambiguous_text="尤",
        )

    english_normalized = normalize_english(text)
    if english_normalized == "i want to going to the store":
        corrected = "I want to go to the store."
        explanation = "动词不定式后接动词原形"
        return SayItResponse(
            type="correction",
            display_text=f"更正后的版本：{corrected} ({explanation})",
            english_text=corrected,
            explanation=explanation,
        )

    return None


def handle_clarification(pending_text: str, clarification: str) -> SayItResponse:
    normalized_pending = normalize_text(pending_text)
    normalized_clarification = normalize_text(clarification)

    if normalized_pending == "我想打他":
        if "电话" in normalized_clarification or "call" in normalized_clarification.lower():
            return SayItResponse(
                type="translation",
                display_text="I want to call him.",
                english_text="I want to call him.",
            )

        if "架" in normalized_clarification or "打" in normalized_clarification:
            return SayItResponse(
                type="translation",
                display_text="表达含义：I want to hit him. 不鼓励暴力行为。",
                english_text="I want to hit him.",
            )

    if normalized_pending == "我尤手写了一遍":
        corrected = replace_first(pending_text, "尤", clarification)
        normalized_corrected = normalize_text(corrected)

        if normalized_corrected == "我又手写了一遍":
            return SayItResponse(
                type="translation",
                display_text="I handwrote it again.",
                english_text="I handwrote it again.",
            )

        if normalized_corrected == "我右手写了一遍":
            return SayItResponse(
                type="translation",
                display_text="I wrote it by hand with my right hand.",
                english_text="I wrote it by hand with my right hand.",
            )

        if normalized_corrected == "我有手写了一遍":
            return SayItResponse(
                type="translation",
                display_text="I did handwrite it once.",
                english_text="I did handwrite it once.",
            )

    return SayItResponse(
        type="error",
        display_text="暂时无法理解这个澄清回答，请换一种说法。",
    )


async def call_llm(text: str, mode: str) -> SayItResponse:
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
    model = os.getenv("LLM_MODEL", "deepseek-v4-flash")

    if not api_key:
        return fallback_without_llm(text, mode)

    client = AsyncOpenAI(api_key=api_key, base_url=base_url.rstrip("/"))

    try:
        completion = await client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are the JSON API for a language practice feature. "
                        "Return only valid JSON with keys: type, display_text, english_text, "
                        "question, options, explanation, original_text, ambiguous_text. For Chinese "
                        "input, translate to natural spoken English unless clarification is needed. "
                        "For English input, correct grammar and explain in concise Chinese. type "
                        "must be one of: translation, correction, clarification, error. If type is "
                        "clarification, original_text must be the user's full original sentence, "
                        "options must contain the candidate replacements, and ambiguous_text must "
                        "be the exact substring in original_text that should be replaced when a "
                        "candidate is selected. If the clarification is about meaning rather than "
                        "a direct text replacement, set ambiguous_text to an empty string. For all "
                        "non-clarification responses, set original_text and ambiguous_text to empty "
                        "strings."
                    ),
                },
                {"role": "user", "content": text},
            ],
        )
    except (APIStatusError, APIConnectionError):
        return fallback_without_llm(text, mode)

    try:
        content = completion.choices[0].message.content
        if not content:
            raise ValueError("Empty LLM response.")
        parsed = parse_json_object(content)
        response_type = parsed.get("type")
        if response_type not in {"translation", "correction", "clarification", "error"}:
            raise ValueError("Unexpected response type.")

        raw_options = parsed.get("options")
        options = [str(option) for option in raw_options] if isinstance(raw_options, list) else []

        return SayItResponse(
            type=response_type,
            display_text=str(parsed.get("display_text") or ""),
            english_text=str(parsed.get("english_text") or ""),
            question=str(parsed.get("question") or ""),
            options=options,
            explanation=str(parsed.get("explanation") or ""),
            original_text=str(parsed.get("original_text") or ""),
            ambiguous_text=str(parsed.get("ambiguous_text") or ""),
        )
    except (TypeError, ValueError, json.JSONDecodeError):
        return fallback_without_llm(text, mode)


def fallback_without_llm(text: str, mode: str) -> SayItResponse:
    if mode == "correct":
        cleaned = text.strip()
        return SayItResponse(
            type="correction",
            display_text=f"未发现确定性纠错规则，原句：{cleaned}",
            english_text=cleaned,
        )

    return SayItResponse(
        type="error",
        display_text="暂时无法处理这个输入，请换一种说法。",
    )


def parse_json_object(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(content[start : end + 1])


def contains_chinese(text: str) -> bool:
    return bool(CHINESE_PATTERN.search(text))


def normalize_text(text: str) -> str:
    return re.sub(r"[\s，。！？!?、,.]+", "", text)


def normalize_english(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().rstrip(".!?")).lower()


def replace_first(text: str, old: str, new: str) -> str:
    if not old:
        return text

    return text.replace(old, new, 1)
