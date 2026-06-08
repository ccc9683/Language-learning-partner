import asyncio

from app.main import app
from app.schemas.say_it import SayItRequest
from app.services.say_it_service import process_say_it


def run_say_it(text: str, pending_text: str | None = None, clarification: str | None = None):
    return asyncio.run(
        process_say_it(
            SayItRequest(
                text=text,
                pending_text=pending_text,
                clarification=clarification,
            )
        )
    ).model_dump()


def test_say_it_route_is_registered():
    assert any(route.path == "/api/say-it" for route in app.routes)


def test_say_it_translates_clear_chinese_input():
    assert run_say_it("我想去超市买东西") == {
        "type": "translation",
        "display_text": "I want to go to the supermarket to buy some things.",
        "english_text": "I want to go to the supermarket to buy some things.",
        "question": "",
        "options": [],
        "explanation": "",
    }


def test_say_it_clarifies_ambiguous_chinese_input_then_calls_him():
    response = run_say_it("我想打他")

    assert response["type"] == "clarification"
    assert response["question"] == "你是想“打电话给他”还是“打架”？"
    assert response["options"] == ["打电话", "打架"]

    clarification_response = run_say_it("打电话", pending_text="我想打他", clarification="打电话")

    assert clarification_response["type"] == "translation"
    assert clarification_response["display_text"] == "I want to call him."
    assert clarification_response["english_text"] == "I want to call him."


def test_say_it_corrects_required_english_sentence():
    data = run_say_it("I want to going to the store")

    assert data["type"] == "correction"
    assert data["display_text"] == "更正后的版本：I want to go to the store. (动词不定式后接动词原形)"
    assert data["english_text"] == "I want to go to the store."
    assert data["explanation"] == "动词不定式后接动词原形"
