from typing import Literal

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class TranslateDetailUsage(BaseModel):
    pattern: str
    example_en: str
    example_zh: str


class TranslateDetailMistake(BaseModel):
    wrong: str
    correct: str
    note: str


class TranslateDetail(BaseModel):
    headword: str
    pos: str | None = None
    meanings: list[str] = Field(default_factory=list)
    usages: list[TranslateDetailUsage] = Field(default_factory=list)
    synonyms: list[str] = Field(default_factory=list)
    common_mistakes: list[TranslateDetailMistake] = Field(default_factory=list)


class TranslateResponse(BaseModel):
    kind: Literal["term", "text"]
    chinese: str
    ipa: str | None = None
    part_of_speech: str | None = None
    detail: TranslateDetail | None = None
