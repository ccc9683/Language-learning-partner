from typing import Literal

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class TranslateResponse(BaseModel):
    kind: Literal["term", "text"]
    chinese: str
    ipa: str | None = None
    part_of_speech: str | None = None
