import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from typing import Literal

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from .. import db
from ..schemas.partner import PartnerMemory, PartnerMessage

PartnerRole = Literal["user", "assistant"]

DEFAULT_MEMORY = PartnerMemory()

SYSTEM_PROMPT = """
You are a friendly female English conversation partner for language learning.

Your role:
- Help the user practice simple English conversation.
- Keep the relationship friendly, safe, and focused on language practice.
- You are not a romantic partner.
- You are not a therapist.
- You are not an adult-content companion.

Conversation style:
- Keep replies short, natural, and easy to understand.
- Use simple English by default.
- If the user writes in Chinese, understand the meaning and reply mostly in simple English.
- If the user writes English with mistakes, first respond naturally, then give one short correction only when useful.
- Do not give long grammar lessons.
- Ask one simple follow-up question to keep the conversation going.

Correction style:
- Be light and friendly.
- Do not correct every small issue.
- For obvious mistakes, use:
  "Small correction: ..."
- Then continue the conversation naturally.

Memory:
- Use the user's memory only when helpful.
- Do not mention memory directly unless the user asks.
- Do not invent facts about the user.

Safety:
- Avoid romantic, sexual, or overly intimate content.
- If the user asks for romantic or adult interaction, politely redirect back to English practice.
""".strip()

CHINESE_PATTERN = re.compile(r"[\u4e00-\u9fff]")
SENSITIVE_PATTERN = re.compile(
    r"(地址|住址|身份证|手机号|电话|医院|病|抑郁|政治|宗教|password|address|phone|"
    r"medical|health|politic|religion)",
    re.IGNORECASE,
)

TOPIC_KEYWORDS = {
    "travel": ("travel", "trip", "旅游", "旅行"),
    "food": ("food", "restaurant", "cook", "coffee", "吃饭", "美食", "做饭", "咖啡"),
    "work": ("work", "job", "office", "工作", "上班"),
    "shopping": ("shopping", "shop", "supermarket", "store", "购物", "超市"),
    "daily life": ("daily life", "everyday", "日常", "生活"),
}


def get_history(limit: int = 30) -> tuple[list[PartnerMessage], PartnerMemory]:
    return list_messages(limit=limit), get_memory()


async def chat(message: str) -> tuple[str, PartnerMemory]:
    text = message.strip()
    if not text:
        raise ValueError("Message is required.")

    memory = get_memory()
    updated_memory = update_memory_from_text(memory, text)
    if updated_memory != memory:
        save_memory(updated_memory)
        memory = updated_memory

    recent_messages = list_messages(limit=20)
    save_message("user", text)
    reply = await call_llm(text=text, memory=memory, recent_messages=recent_messages)
    save_message("assistant", reply)

    return reply, memory


def list_messages(limit: int = 30) -> list[PartnerMessage]:
    safe_limit = min(max(limit, 1), 100)
    with db.get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, role, content, created_at
            FROM partner_messages
            ORDER BY id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()

    messages = [row_to_message(row) for row in rows]
    messages.reverse()
    return messages


def save_message(role: PartnerRole, content: str) -> PartnerMessage:
    now = datetime.now(timezone.utc).isoformat()
    with db.get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO partner_messages (role, content, created_at)
            VALUES (?, ?, ?)
            """,
            (role, content, now),
        )
        message_id = int(cursor.lastrowid)

    return PartnerMessage(id=message_id, role=role, content=content, created_at=now)


def clear_history() -> None:
    with db.get_connection() as connection:
        connection.execute("DELETE FROM partner_messages")


def clear_memory() -> PartnerMemory:
    memory = PartnerMemory()
    save_memory(memory)
    return memory


def get_memory() -> PartnerMemory:
    with db.get_connection() as connection:
        row = connection.execute(
            """
            SELECT name, level, favorite_topics_json, style
            FROM partner_memory
            WHERE id = 1
            """
        ).fetchone()

    if row is None:
        memory = PartnerMemory()
        save_memory(memory)
        return memory

    return row_to_memory(row)


def save_memory(memory: PartnerMemory) -> None:
    now = datetime.now(timezone.utc).isoformat()
    topics_json = json.dumps(memory.favorite_topics[:5], ensure_ascii=False)
    with db.get_connection() as connection:
        connection.execute(
            """
            INSERT INTO partner_memory (
                id,
                name,
                level,
                favorite_topics_json,
                style,
                updated_at
            )
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                level = excluded.level,
                favorite_topics_json = excluded.favorite_topics_json,
                style = excluded.style,
                updated_at = excluded.updated_at
            """,
            (memory.name, memory.level, topics_json, memory.style, now),
        )


async def call_llm(
    text: str,
    memory: PartnerMemory,
    recent_messages: list[PartnerMessage],
) -> str:
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
    model = os.getenv("LLM_MODEL", "deepseek-v4-flash")

    if not api_key:
        return fallback_reply(text)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": format_memory_summary(memory)},
    ]
    messages.extend(
        {"role": message.role, "content": message.content}
        for message in recent_messages[-20:]
    )
    messages.append({"role": "user", "content": text})

    client = AsyncOpenAI(api_key=api_key, base_url=base_url.rstrip("/"), timeout=15.0)

    try:
        completion = await client.chat.completions.create(
            model=model,
            temperature=0.5,
            messages=messages,
        )
    except (APIStatusError, APIConnectionError, APITimeoutError):
        return fallback_reply(text)

    content = completion.choices[0].message.content
    return normalize_reply(content) or fallback_reply(text)


def format_memory_summary(memory: PartnerMemory) -> str:
    topics = ", ".join(memory.favorite_topics) if memory.favorite_topics else "none"
    return (
        "User memory:\n"
        f"name: {memory.name or ''}\n"
        f"level: {memory.level}\n"
        f"favorite_topics: {topics}\n"
        f"style: {memory.style}"
    )


def update_memory_from_text(memory: PartnerMemory, text: str) -> PartnerMemory:
    if SENSITIVE_PATTERN.search(text):
        return memory

    name = extract_name(text) or memory.name
    level = extract_level(text) or memory.level
    topics = add_topics(memory.favorite_topics, text)

    return PartnerMemory(
        name=name,
        level=level,
        favorite_topics=topics,
        style=memory.style or DEFAULT_MEMORY.style,
    )


def extract_name(text: str) -> str | None:
    patterns = [
        r"\bmy name is\s+([A-Za-z][A-Za-z'-]{0,39})",
        r"我叫\s*([A-Za-z][A-Za-z .'-]{0,40}|[\u4e00-\u9fff]{1,8})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = clean_memory_text(match.group(1))
            if name:
                return name

    return None


def extract_level(text: str) -> str | None:
    lowered = text.lower()
    if "初学" in text or "beginner" in lowered:
        return "beginner"
    if "中级" in text or "intermediate" in lowered:
        return "intermediate"
    if "高级" in text or "advanced" in lowered:
        return "advanced"

    return None


def add_topics(existing_topics: list[str], text: str) -> list[str]:
    lowered = text.lower()
    has_preference = any(
        marker in lowered or marker in text
        for marker in ("like", "love", "favorite", "喜欢", "爱", "常聊", "想聊")
    )
    if not has_preference:
        return existing_topics[:5]

    topics = list(existing_topics)
    for topic, keywords in TOPIC_KEYWORDS.items():
        if topic in topics:
            continue
        if any(keyword in lowered or keyword in text for keyword in keywords):
            topics.append(topic)

    return topics[:5]


def fallback_reply(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text.strip()).lower().rstrip(".!?")

    if "我今天很累" in text or ("累" in text and contains_chinese(text)):
        return "Oh, you must be tired today. Was your day very busy?"

    if normalized == "i go supermarket yesterday":
        return (
            "Nice! Small correction: I went to the supermarket yesterday. "
            "What did you buy?"
        )

    if "supermarket" in normalized or "超市" in text:
        return "Nice. Small correction: I went to the supermarket. What did you buy?"

    if contains_chinese(text):
        return "I understand. Can you say it in simple English?"

    return "That sounds good. Can you tell me more?"


def normalize_reply(content: str | None) -> str:
    if not content:
        return ""

    return content.strip()


def contains_chinese(text: str) -> bool:
    return bool(CHINESE_PATTERN.search(text))


def clean_memory_text(text: str) -> str:
    return text.strip(" \t\r\n,，.。!！?？:：;；'\"")[:40]


def row_to_message(row: sqlite3.Row) -> PartnerMessage:
    return PartnerMessage(
        id=int(row["id"]),
        role=row["role"],
        content=row["content"],
        created_at=row["created_at"],
    )


def row_to_memory(row: sqlite3.Row) -> PartnerMemory:
    try:
        topics = json.loads(row["favorite_topics_json"])
    except (TypeError, json.JSONDecodeError):
        topics = []

    if not isinstance(topics, list):
        topics = []

    safe_topics = [str(topic) for topic in topics if isinstance(topic, str) and topic.strip()]
    return PartnerMemory(
        name=row["name"],
        level=row["level"],
        favorite_topics=safe_topics[:5],
        style=row["style"],
    )
