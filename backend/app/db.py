import sqlite3
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
