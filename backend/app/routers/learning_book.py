from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from ..schemas.learning_book import LearningItem, LearningItemCreate, LearningItemType, ReviewStats, ReviewSubmission
from ..services.learning_book_service import (
    create_learning_item,
    delete_learning_item,
    list_learning_items,
    list_due_items,
    get_review_stats,
    submit_review,
)

router = APIRouter(prefix="/api/learning-items", tags=["learning-book"])


@router.get("/review/stats", response_model=ReviewStats)
async def review_stats(start: datetime, end: datetime) -> dict:
    if start.utcoffset() is None or end.utcoffset() is None or start >= end:
        raise HTTPException(status_code=422, detail="A valid timezone-aware time range is required.")
    return get_review_stats(start, end)


@router.get("/review", response_model=list[LearningItem])
async def get_due_items(limit: int = Query(default=50, ge=1, le=200)) -> list[LearningItem]:
    return list_due_items(limit)


@router.post("/{item_id}/review", response_model=LearningItem)
async def review_item(item_id: int, payload: ReviewSubmission) -> LearningItem:
    item = submit_review(item_id, payload.remembered)
    if item is None:
        raise HTTPException(status_code=404, detail="Learning item not found.")
    return item


@router.post("", response_model=LearningItem)
async def create_item(payload: LearningItemCreate) -> LearningItem:
    return create_learning_item(payload)


@router.get("", response_model=list[LearningItem])
async def get_items(
    type: LearningItemType | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[LearningItem]:
    return list_learning_items(item_type=type, limit=limit)


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: int) -> None:
    deleted = delete_learning_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Learning item not found.")
