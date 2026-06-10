import asyncio
from pathlib import Path

import pytest

from app import db
from app.main import app
from app.services import partner_service


@pytest.fixture()
def partner_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db, "DATA_DIR", tmp_path)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "llp.db")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    db.init_db()


def test_partner_routes_are_registered():
    route_paths = {route.path for route in app.routes}

    assert "/api/partner/history" in route_paths
    assert "/api/partner/chat" in route_paths
    assert "/api/partner/clear-history" in route_paths
    assert "/api/partner/clear-memory" in route_paths


def test_partner_memory_defaults_and_can_reset(partner_db: None):
    memory = partner_service.get_memory()

    assert memory.name == ""
    assert memory.level == "beginner"
    assert memory.favorite_topics == []
    assert memory.style == "simple English"

    partner_service.save_memory(
        memory.model_copy(update={"name": "Tom", "favorite_topics": ["travel"]})
    )
    reset = partner_service.clear_memory()

    assert reset.name == ""
    assert reset.favorite_topics == []
    assert partner_service.get_memory().style == "simple English"


def test_partner_chat_fallback_saves_user_and_assistant_messages(partner_db: None):
    reply, memory = asyncio.run(partner_service.chat("I go supermarket yesterday."))
    messages, saved_memory = partner_service.get_history()

    assert "Small correction: I went to the supermarket yesterday." in reply
    assert memory == saved_memory
    assert [message.role for message in messages] == ["user", "assistant"]
    assert messages[0].content == "I go supermarket yesterday."
    assert messages[1].content == reply


def test_partner_updates_only_light_memory(partner_db: None):
    reply, memory = asyncio.run(partner_service.chat("My name is Tom. I like travel."))

    assert reply
    assert memory.name == "Tom"
    assert "travel" in memory.favorite_topics


def test_partner_clear_history_keeps_memory(partner_db: None):
    asyncio.run(partner_service.chat("我叫 Tom"))
    partner_service.clear_history()
    messages, memory = partner_service.get_history()

    assert messages == []
    assert memory.name == "Tom"
