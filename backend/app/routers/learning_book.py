from fastapi import APIRouter, HTTPException, Query

from ..schemas.learning_book import LearningItem, LearningItemCreate, LearningItemType
from ..services.learning_book_service import (
    create_learning_item,
    delete_learning_item,
    list_learning_items,
)

router = APIRouter(prefix="/api/learning-items", tags=["learning-book"])


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
