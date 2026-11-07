from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app import db
from app.main import app
from app.schemas.learning_book import LearningItemCreate
from app.services.learning_book_service import (
    create_learning_item,
    delete_learning_item,
    list_learning_items,
)


@pytest.fixture()
def learning_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db, "DATA_DIR", tmp_path)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "llp.db")
    db.init_db()


def test_learning_book_routes_are_registered():
    route_paths = {route.path for route in app.routes}

    assert "/api/learning-items" in route_paths
    assert "/api/learning-items/{item_id}" in route_paths


def test_learning_item_word_create_deduplicates_and_lists(learning_db: None):
    payload = LearningItemCreate(
        type="word",
        source_text="Consider",
        phonetic="/kənˈsɪdər/",
        part_of_speech="动词",
        meaning="考虑, 认为",
        detail_json='{"headword":"consider"}',
    )

    created = create_learning_item(payload)
    duplicate = create_learning_item(payload.model_copy(update={"source_text": "consider"}))
    listing = list_learning_items(item_type="word")

    assert created.id == duplicate.id
    assert created.unique_key == "word:consider"
    assert len(listing) == 1
    assert listing[0].meaning == "考虑, 认为"


def test_learning_item_sentence_create_filter_and_delete(learning_db: None):
    word = create_learning_item(
        LearningItemCreate(
            type="word",
            source_text="hello",
            meaning="你好",
        )
    )
    sentence = create_learning_item(
        LearningItemCreate(
            type="sentence",
            source_text="我想去超市买东西",
            target_text="I want to go to the supermarket to buy some things.",
        )
    )

    sentence_items = list_learning_items(item_type="sentence")
    deleted = delete_learning_item(sentence.id)
    missing = delete_learning_item(sentence.id)
    all_items = list_learning_items()

    assert sentence.unique_key.startswith("sentence:我想去超市买东西:")
    assert len(sentence_items) == 1
    assert deleted is True
    assert missing is False
    assert [item.id for item in all_items] == [word.id]


@pytest.mark.asyncio
async def test_review_schedule_and_persistence(learning_db: None):
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    item = create_learning_item(LearningItemCreate(type="word", source_text="hello", meaning="你好"))
    assert [entry["id"] for entry in (await client.get("/api/learning-items/review")).json()] == [item.id]

    response = await client.post(f"/api/learning-items/{item.id}/review", json={"remembered": True})
    assert response.status_code == 200
    assert response.json()["review_count"] == 1
    assert response.json()["last_reviewed_at"] is not None
    assert (await client.get("/api/learning-items/review")).json() == []

    with db.get_connection() as connection:
        connection.execute("UPDATE learning_items SET last_reviewed_at = ? WHERE id = ?", (
            (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), item.id
        ))
    assert len((await client.get("/api/learning-items/review")).json()) == 1
    assert (await client.post(f"/api/learning-items/{item.id}/review", json={"remembered": True})).json()["review_count"] == 2
    with db.get_connection() as connection:
        connection.execute("UPDATE learning_items SET last_reviewed_at = ? WHERE id = ?", (
            (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), item.id
        ))
    assert (await client.get("/api/learning-items/review")).json() == []
    reset = (await client.post(f"/api/learning-items/{item.id}/review", json={"remembered": False})).json()
    assert reset["review_count"] == 0
    assert (await client.get("/api/learning-items/review")).json() == []
    assert (await client.post("/api/learning-items/99999/review", json={"remembered": True})).status_code == 404
    await client.aclose()


@pytest.mark.asyncio
async def test_daily_review_stats_count_unique_items_and_respect_boundaries(learning_db: None):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        word = create_learning_item(LearningItemCreate(type="word", source_text="hello"))
        sentence = create_learning_item(LearningItemCreate(type="sentence", source_text="你好", target_text="hello"))
        await client.post(f"/api/learning-items/{word.id}/review", json={"remembered": False})
        await client.post(f"/api/learning-items/{word.id}/review", json={"remembered": True})
        await client.post(f"/api/learning-items/{sentence.id}/review", json={"remembered": False})
        now = datetime.now(timezone.utc)
        params = {"start": (now - timedelta(minutes=1)).isoformat(), "end": (now + timedelta(minutes=1)).isoformat()}
        response = await client.get("/api/learning-items/review/stats", params=params)
        assert response.json() == {"reviewed": 2, "remembered": 1, "item_counts": {str(word.id): 2, str(sentence.id): 1}}
        params = {"start": (now - timedelta(days=2)).isoformat(), "end": (now - timedelta(days=1)).isoformat()}
        assert (await client.get("/api/learning-items/review/stats", params=params)).json() == {"reviewed": 0, "remembered": 0, "item_counts": {}}
        assert (await client.get("/api/learning-items/review/stats", params={"start": "2026-01-01T00:00:00", "end": "2026-01-02T00:00:00"})).status_code == 422
