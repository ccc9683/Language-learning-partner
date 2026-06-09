from pathlib import Path

import pytest

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
