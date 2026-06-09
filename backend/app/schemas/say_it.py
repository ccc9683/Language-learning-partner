from typing import Literal

from pydantic import BaseModel, Field


class SayItRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    pending_text: str | None = Field(default=None, max_length=4000)
    clarification: str | None = Field(default=None, max_length=1000)


class SayItResponse(BaseModel):
    type: Literal["translation", "correction", "clarification", "error"]
    display_text: str = ""
    english_text: str = ""
    question: str = ""
    options: list[str] = Field(default_factory=list)
    explanation: str = ""
    original_text: str = ""
    ambiguous_text: str = ""
