from typing import Literal

from pydantic import BaseModel, Field

LearningItemType = Literal["word", "sentence"]


class LearningItemCreate(BaseModel):
    type: LearningItemType
    source_text: str = Field(..., min_length=1, max_length=4000)
    target_text: str | None = None
    phonetic: str | None = None
    part_of_speech: str | None = None
    meaning: str | None = None
    detail_json: str | None = None
    note: str | None = None


class LearningItem(BaseModel):
    id: int
    type: LearningItemType
    source_text: str
    target_text: str | None = None
    phonetic: str | None = None
    part_of_speech: str | None = None
    meaning: str | None = None
    detail_json: str | None = None
    note: str | None = None
    favorite: int
    review_count: int
    last_reviewed_at: str | None = None
    unique_key: str
    created_at: str
    updated_at: str
