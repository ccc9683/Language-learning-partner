import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "llp.db"


def get_connection() -> sqlite3.Connection:
    init_db()
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS learning_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK (type IN ('word', 'sentence')),
                source_text TEXT NOT NULL,
                target_text TEXT,
                phonetic TEXT,
                part_of_speech TEXT,
                meaning TEXT,
                detail_json TEXT,
                note TEXT,
                favorite INTEGER NOT NULL DEFAULT 1,
                review_count INTEGER NOT NULL DEFAULT 0,
                last_reviewed_at TEXT,
                unique_key TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS partner_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS partner_memory (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL DEFAULT '',
                level TEXT NOT NULL DEFAULT 'beginner',
                favorite_topics_json TEXT NOT NULL DEFAULT '[]',
                style TEXT NOT NULL DEFAULT 'simple English',
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO partner_memory (
                id,
                name,
                level,
                favorite_topics_json,
                style,
                updated_at
            )
            VALUES (1, '', 'beginner', '[]', 'simple English', ?)
            """,
            (now,),
        )
