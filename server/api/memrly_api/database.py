"""Short-lived PostgreSQL connections scoped to Memrly's independent database."""
from collections.abc import Generator
import psycopg
from psycopg.rows import dict_row
from .config import settings

def get_conn() -> Generator[psycopg.Connection, None, None]:
    cfg = settings()
    with psycopg.connect(
        host=cfg["db_host"], dbname=cfg["db_name"], user=cfg["db_user"],
        password=cfg["db_password"], connect_timeout=5, row_factory=dict_row,
    ) as conn:
        yield conn
