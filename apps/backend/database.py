import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


def connect():
    return psycopg.connect(
        os.environ["DATABASE_URL"], row_factory=dict_row, connect_timeout=5
    )


def migrate():
    with connect() as db:
        db.execute("SELECT pg_advisory_xact_lock(534921)")
        db.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY)"
        )
        for path in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
            if db.execute(
                "SELECT 1 FROM schema_migrations WHERE version = %s", (path.name,)
            ).fetchone():
                continue
            # Phase 1 initialized its tables before migration tracking existed.
            legacy = (
                path.name == "001_snippets.sql"
                and db.execute(
                    "SELECT to_regclass('snippets') AS table_name"
                ).fetchone()["table_name"]
            )
            if not legacy:
                db.execute(path.read_text("utf-8"))
            db.execute("INSERT INTO schema_migrations VALUES (%s)", (path.name,))


if __name__ == "__main__":
    migrate()
