from app.main import parse_detail
from app.schemas.translator import TranslateResponse


def test_translate_response_accepts_missing_detail():
    response = TranslateResponse(
        kind="term",
        chinese="考虑, 认为",
        ipa="/kənˈsɪdər/",
        part_of_speech="动词",
    )

    assert response.detail is None
    assert response.chinese == "考虑, 认为"


def test_parse_detail_only_keeps_valid_term_detail():
    detail = parse_detail(
        kind="term",
        detail={
            "headword": "consider",
            "pos": "v.",
            "meanings": ["考虑", "认为"],
            "usages": [
                {
                    "pattern": "consider doing sth",
                    "example_en": "I'm considering changing jobs.",
                    "example_zh": "我正在考虑换工作。",
                }
            ],
            "synonyms": ["think about", "regard", "view"],
            "common_mistakes": [
                {
                    "wrong": "consider to do",
                    "correct": "consider doing",
                    "note": "consider 后接动名词。",
                }
            ],
        },
        source_text="censider",
        chinese="考虑, 认为",
        part_of_speech="动词",
    )

    assert detail is not None
    assert detail.headword == "consider"
    assert detail.usages[0].pattern == "consider doing sth"


def test_parse_detail_builds_fallback_when_term_detail_is_missing():
    detail = parse_detail(
        kind="term",
        detail=None,
        source_text="consider",
        chinese="考虑, 认为",
        part_of_speech="动词",
    )

    assert detail is not None
    assert detail.headword == "consider"
    assert detail.pos == "动词"
    assert detail.meanings == ["考虑", "认为"]
    assert detail.usages == []
    assert detail.synonyms == []
    assert detail.common_mistakes == []


def test_parse_detail_keeps_headword_when_invalid_detail_falls_back():
    detail = parse_detail(
        kind="term",
        detail={
            "headword": "consider",
            "usages": "bad format",
        },
        source_text="censider",
        chinese="考虑, 认为",
        part_of_speech="动词",
    )

    assert detail is not None
    assert detail.headword == "consider"
    assert detail.meanings == ["考虑", "认为"]


def test_parse_detail_returns_none_for_text():
    detail = parse_detail(
        kind="text",
        detail={"headword": "consider"},
        source_text="I am considering changing jobs.",
        chinese="我正在考虑换工作。",
        part_of_speech=None,
    )

    assert detail is None
