from typing import Literal

from pydantic import BaseModel, Field


class PartnerMessage(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: str


class PartnerMemory(BaseModel):
    name: str = ""
    level: str = "beginner"
    favorite_topics: list[str] = Field(default_factory=list)
    style: str = "simple English"


class PartnerHistoryResponse(BaseModel):
    messages: list[PartnerMessage]
    memory: PartnerMemory


class PartnerChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class PartnerChatResponse(BaseModel):
    reply: str
    updated_memory: PartnerMemory


class PartnerOkResponse(BaseModel):
    ok: bool


class PartnerClearMemoryResponse(BaseModel):
    ok: bool
    memory: PartnerMemory
