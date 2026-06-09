import sqlite3
from datetime import datetime, timezone

from .. import db
from ..schemas.learning_book import LearningItem, LearningItemCreate, LearningItemType


def create_learning_item(payload: LearningItemCreate) -> LearningItem:
    now = datetime.now(timezone.utc).isoformat()
    source_text = payload.source_text.strip()
    target_text = clean_optional(payload.target_text)
    unique_key = build_unique_key(payload.type, source_text, target_text)

    existing = get_item_by_unique_key(unique_key)
    if existing:
        return existing

    with db.get_connection() as connection:
        try:
            cursor = connection.execute(
                """
                INSERT INTO learning_items (
                    type,
                    source_text,
                    target_text,
                    phonetic,
                    part_of_speech,
                    meaning,
                    detail_json,
                    note,
                    favorite,
                    review_count,
                    last_reviewed_at,
                    unique_key,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, ?, ?)
                """,
                (
                    payload.type,
                    source_text,
                    target_text,
                    clean_optional(payload.phonetic),
                    clean_optional(payload.part_of_speech),
                    clean_optional(payload.meaning),
                    clean_optional(payload.detail_json),
                    clean_optional(payload.note),
                    unique_key,
                    now,
                    now,
                ),
            )
            item_id = int(cursor.lastrowid)
        except sqlite3.IntegrityError:
            duplicate = get_item_by_unique_key(unique_key)
            if duplicate:
                return duplicate
            raise

    return get_learning_item(item_id)


def list_learning_items(
    item_type: LearningItemType | None = None,
    limit: int = 50,
) -> list[LearningItem]:
    safe_limit = min(max(limit, 1), 200)

    if item_type:
        query = """
            SELECT * FROM learning_items
            WHERE type = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        """
        params: tuple[object, ...] = (item_type, safe_limit)
    else:
        query = """
            SELECT * FROM learning_items
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        """
        params = (safe_limit,)

    with db.get_connection() as connection:
        rows = connection.execute(query, params).fetchall()

    return [row_to_item(row) for row in rows]


def delete_learning_item(item_id: int) -> bool:
    with db.get_connection() as connection:
        cursor = connection.execute("DELETE FROM learning_items WHERE id = ?", (item_id,))
        return cursor.rowcount > 0


def get_learning_item(item_id: int) -> LearningItem:
    with db.get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM learning_items WHERE id = ?",
            (item_id,),
        ).fetchone()

    if row is None:
        raise ValueError(f"Learning item {item_id} was not found.")

    return row_to_item(row)


def get_item_by_unique_key(unique_key: str) -> LearningItem | None:
    with db.get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM learning_items WHERE unique_key = ?",
            (unique_key,),
        ).fetchone()

    return row_to_item(row) if row else None


def build_unique_key(item_type: LearningItemType, source_text: str, target_text: str | None) -> str:
    if item_type == "word":
        return f"word:{source_text.lower()}"

    return f"sentence:{source_text}:{target_text or ''}"


def clean_optional(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def row_to_item(row: sqlite3.Row) -> LearningItem:
    return LearningItem(
        id=int(row["id"]),
        type=row["type"],
        source_text=row["source_text"],
        target_text=row["target_text"],
        phonetic=row["phonetic"],
        part_of_speech=row["part_of_speech"],
        meaning=row["meaning"],
        detail_json=row["detail_json"],
        note=row["note"],
        favorite=int(row["favorite"]),
        review_count=int(row["review_count"]),
        last_reviewed_at=row["last_reviewed_at"],
        unique_key=row["unique_key"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
