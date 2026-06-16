"""
NirmanIQ — PostgreSQL persistence layer
────────────────────────────────────────────────────────────────────────────────
Primary DB: PostgreSQL (via DATABASE_URL env var)
Fallback:   SQLite at data/nirmaniq.db  (local dev without Docker)

All public function signatures are IDENTICAL to the SQLite version — no changes
needed in api.py, auth.py, or any other caller.
"""

import json
import os
import hashlib
import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("nirmaniq_db")

# ── Config ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_POSTGRES  = bool(DATABASE_URL and "postgresql" in DATABASE_URL)

# SQLite fallback path
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH  = DATA_DIR / "nirmaniq.db"

# ── Connection pool (PostgreSQL only) ─────────────────────────────────────────
_pool = None

def _init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    try:
        from psycopg2 import pool as pgpool
        _pool = pgpool.ThreadedConnectionPool(minconn=2, maxconn=20, dsn=DATABASE_URL)
        logger.info(f"PostgreSQL pool ready → {DATABASE_URL.split('@')[-1]}")
    except Exception as e:
        logger.error(f"PostgreSQL pool init failed: {e}")
        raise

# ── Unified context manager ────────────────────────────────────────────────────

@contextmanager
def db():
    """
    Yields a connection that behaves the same regardless of backend.
    Rows are accessible as dicts (both SQLite Row and psycopg2 RealDictCursor).
    """
    if USE_POSTGRES:
        import psycopg2
        import psycopg2.extras
        if _pool is None:
            _init_pool()
        conn = _pool.getconn()
        try:
            yield _PGConnWrapper(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            _pool.putconn(conn)
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield _SQLiteConnWrapper(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()



def get_conn():
    """
    Returns a raw connection for use by auth.py and other callers that
    manage their own commit/close lifecycle.
    Works for both SQLite and PostgreSQL.
    """
    if USE_POSTGRES:
        if _pool is None:
            _init_pool()
        raw = _pool.getconn()
        return _PGRawConn(raw)
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn


class _PGRawConn:
    """Wraps psycopg2 connection — makes it look like sqlite3.Connection for auth.py."""
    def __init__(self, raw_conn):
        self._raw = raw_conn

    def execute(self, sql: str, params=()):
        import psycopg2.extras
        cur = self._raw.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            sql.replace("?", "%s").replace("datetime('now')", "NOW()"),
            params
        )
        return _PGCursorWrapper(cur)

    def executescript(self, script: str):
        cur = self._raw.cursor()
        for stmt in script.split(";"):
            s = stmt.strip()
            if s and not s.startswith("--"):
                try:
                    cur.execute(s)
                except Exception:
                    pass

    def commit(self):   self._raw.commit()
    def rollback(self): self._raw.rollback()

    def close(self):
        if _pool:
            _pool.putconn(self._raw)


class _PGConnWrapper:
    """Wraps psycopg2 connection — translates ? placeholders and datetime() calls."""
    def __init__(self, conn):
        self._conn = conn

    def _translate(self, sql: str) -> str:
        # SQLite → PostgreSQL syntax
        sql = sql.replace("?", "%s")
        sql = sql.replace("datetime('now')", "NOW()")
        sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
        sql = sql.replace("PRAGMA journal_mode=WAL;", "")
        sql = sql.replace("PRAGMA foreign_keys=ON;", "")
        return sql

    def execute(self, sql: str, params=()):
        import psycopg2.extras
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(self._translate(sql), params)
        return _PGCursorWrapper(cur)

    def executemany(self, sql: str, seq):
        cur = self._conn.cursor()
        cur.executemany(self._translate(sql), seq)
        return cur

    def executescript(self, script: str):
        """Execute a multi-statement script (used for migrations)."""
        import psycopg2.extras
        cur = self._conn.cursor()
        # Split on ; and run each non-empty statement
        for stmt in script.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                try:
                    cur.execute(self._translate(stmt))
                except Exception as e:
                    logger.debug(f"Script stmt skipped: {e}: {stmt[:60]}")
        return cur

    def commit(self):   self._conn.commit()
    def rollback(self): self._conn.rollback()


class _SQLiteConnWrapper:
    """Thin wrapper over sqlite3.Connection for API compatibility."""
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return self._conn.execute(sql, params)

    def executemany(self, sql, seq):
        return self._conn.executemany(sql, seq)

    def executescript(self, script):
        return self._conn.executescript(script)

    def commit(self):   self._conn.commit()
    def rollback(self): self._conn.rollback()


class _PGCursorWrapper:
    """Wraps psycopg2 cursor — makes rows dict-like for SQLite Row compatibility."""
    def __init__(self, cur):
        self._cur = cur

    def fetchone(self):
        row = self._cur.fetchone()
        return dict(row) if row else None

    def fetchall(self):
        return [dict(r) for r in self._cur.fetchall()]

    @property
    def lastrowid(self):
        return self._cur.fetchone()


# ── PostgreSQL Schema (CREATE TABLE IF NOT EXISTS) ────────────────────────────

PG_SCHEMA = """
CREATE TABLE IF NOT EXISTS market_rates (
    id           TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    value        REAL NOT NULL,
    unit         TEXT DEFAULT '',
    category     TEXT DEFAULT 'material',
    notes        TEXT DEFAULT '',
    updated_at   TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS material_master (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    unit         TEXT NOT NULL,
    required_qty REAL DEFAULT 0,
    color_cat    TEXT DEFAULT 'steel',
    sort_order   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS team_roles (
    id             TEXT PRIMARY KEY,
    role_name      TEXT NOT NULL,
    default_salary REAL DEFAULT 0,
    sort_order     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prereq_master (
    id          TEXT PRIMARY KEY,
    group_id    TEXT NOT NULL,
    group_label TEXT NOT NULL,
    group_icon  TEXT DEFAULT '📋',
    item_id     TEXT NOT NULL,
    item_text   TEXT NOT NULL,
    seq         INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quality_issues (
    id              TEXT PRIMARY KEY,
    stage_id        TEXT NOT NULL,
    stage_label     TEXT DEFAULT '',
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    severity        TEXT DEFAULT 'medium',
    status          TEXT DEFAULT 'open',
    assigned_to     TEXT DEFAULT '',
    due_date        TEXT DEFAULT '',
    closure_note    TEXT DEFAULT '',
    closure_photo   TEXT DEFAULT '',
    ai_detected     INTEGER DEFAULT 0,
    ai_confidence   REAL DEFAULT 0,
    created_at      TEXT DEFAULT (NOW()::TEXT),
    updated_at      TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS required_photos (
    id          TEXT PRIMARY KEY,
    stage_id    TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT DEFAULT '',
    mandatory   INTEGER DEFAULT 1,
    uploaded_at TEXT DEFAULT '',
    photo_id    TEXT DEFAULT '',
    ai_reviewed INTEGER DEFAULT 0,
    ai_ok       INTEGER DEFAULT 0,
    ai_notes    TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,
    ts          TEXT DEFAULT (NOW()::TEXT),
    user_id     TEXT DEFAULT 'owner',
    action      TEXT NOT NULL,
    entity_type TEXT DEFAULT '',
    entity_id   TEXT DEFAULT '',
    detail      TEXT DEFAULT '',
    stage_id    TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS budget_alerts (
    id           TEXT PRIMARY KEY,
    cat_id       TEXT NOT NULL,
    threshold    REAL NOT NULL,
    triggered    INTEGER DEFAULT 0,
    triggered_at TEXT DEFAULT '',
    acknowledged INTEGER DEFAULT 0,
    ack_at       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS project (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS kv_store (
    key        TEXT NOT NULL,
    user_id    TEXT NOT NULL DEFAULT 'default',
    value      TEXT NOT NULL,
    updated_at TEXT DEFAULT (NOW()::TEXT),
    PRIMARY KEY (key, user_id)
);

CREATE TABLE IF NOT EXISTS stages (
    stage_id  TEXT NOT NULL,
    task_id   TEXT NOT NULL,
    done      INTEGER DEFAULT 0,
    done_date TEXT DEFAULT '',
    PRIMARY KEY (stage_id, task_id)
);

CREATE TABLE IF NOT EXISTS materials (
    mat_id   TEXT PRIMARY KEY,
    ordered  REAL DEFAULT 0,
    received REAL DEFAULT 0,
    rate     REAL DEFAULT 0,
    supplier TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payments (
    id               TEXT PRIMARY KEY,
    description      TEXT NOT NULL,
    amount           REAL NOT NULL,
    cat_id           TEXT NOT NULL,
    date             TEXT NOT NULL,
    stage_id         TEXT DEFAULT '',
    payment_category TEXT DEFAULT '',
    vendor_name      TEXT DEFAULT '',
    payment_mode     TEXT DEFAULT 'Cash',
    ref_number       TEXT DEFAULT '',
    created_at       TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS logs (
    id         TEXT PRIMARY KEY,
    date       TEXT NOT NULL,
    time       TEXT NOT NULL,
    text       TEXT NOT NULL,
    stage      TEXT DEFAULT '',
    stage_id   TEXT DEFAULT '',
    created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    src         TEXT NOT NULL,
    stage_label TEXT DEFAULT '',
    stage_id    TEXT DEFAULT '',
    date        TEXT NOT NULL,
    created_at  TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS team (
    idx    INTEGER PRIMARY KEY,
    role   TEXT NOT NULL,
    name   TEXT DEFAULT '',
    phone  TEXT DEFAULT '',
    salary REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    hired  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS customers (
    id         TEXT PRIMARY KEY,
    name       TEXT DEFAULT '',
    email      TEXT DEFAULT '',
    phone      TEXT DEFAULT '',
    created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS loan_items (
    item_id   TEXT PRIMARY KEY,
    done      INTEGER DEFAULT 0,
    done_date TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cash_flow (
    id              TEXT PRIMARY KEY,
    date            TEXT NOT NULL,
    type            TEXT NOT NULL,
    source          TEXT DEFAULT '',
    amount          REAL NOT NULL,
    description     TEXT DEFAULT '',
    stage_id        TEXT DEFAULT '',
    ref_number      TEXT DEFAULT '',
    emi_principal   REAL DEFAULT 0,
    emi_interest    REAL DEFAULT 0,
    loan_name       TEXT DEFAULT '',
    created_at      TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS ai_cache (
    cache_key  TEXT PRIMARY KEY,
    stage_id   TEXT NOT NULL,
    result     TEXT NOT NULL,
    created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT DEFAULT '',
    phone          TEXT DEFAULT '',
    password_hash  TEXT NOT NULL,
    role           TEXT DEFAULT 'owner',
    is_verified    INTEGER DEFAULT 0,
    mfa_enabled    INTEGER DEFAULT 1,
    created_at     TEXT DEFAULT (NOW()::TEXT),
    last_login_at  TEXT DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone <> '';

CREATE TABLE IF NOT EXISTS otp_store (
    id         TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    otp_hash   TEXT NOT NULL,
    purpose    TEXT NOT NULL,
    attempts   INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (NOW()::TEXT),
    expires_at TEXT NOT NULL,
    revoked    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stage_estimates (
    stage_id       TEXT PRIMARY KEY,
    estimated_cost REAL DEFAULT 0,
    item_count     INTEGER DEFAULT 0,
    updated_at     TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS stage_mat_actuals (
    stage_id    TEXT NOT NULL,
    item_id     TEXT NOT NULL,
    ordered     REAL DEFAULT 0,
    received    REAL DEFAULT 0,
    rate        REAL DEFAULT 0,
    supplier    TEXT DEFAULT '',
    updated_at  TEXT DEFAULT (NOW()::TEXT),
    PRIMARY KEY (stage_id, item_id)
);

CREATE TABLE IF NOT EXISTS stage_master (
    id              TEXT PRIMARY KEY,
    label           TEXT NOT NULL,
    icon            TEXT DEFAULT '🏗',
    color           TEXT DEFAULT '#3D7EFF',
    phase           TEXT DEFAULT 'foundation',
    budget_pct      REAL DEFAULT 0,
    duration_wks    INTEGER DEFAULT 4,
    budget_cat_id   TEXT DEFAULT '',
    sort_order      INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    contract_amount REAL DEFAULT 0,
    payment_rule    TEXT DEFAULT '',
    created_at      TEXT DEFAULT (NOW()::TEXT),
    updated_at      TEXT DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS stage_checklist (
    id        TEXT PRIMARY KEY,
    stage_id  TEXT NOT NULL,
    seq       INTEGER NOT NULL,
    text      TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stage_photo_defs (
    id          TEXT PRIMARY KEY,
    stage_id    TEXT NOT NULL,
    seq         INTEGER NOT NULL,
    label       TEXT NOT NULL,
    description TEXT DEFAULT '',
    mandatory   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stage_quality_defs (
    id         TEXT PRIMARY KEY,
    stage_id   TEXT NOT NULL,
    seq        INTEGER NOT NULL,
    check_text TEXT NOT NULL,
    severity   TEXT DEFAULT 'medium'
);

CREATE TABLE IF NOT EXISTS stage_material_ids (
    stage_id TEXT NOT NULL,
    mat_id   TEXT NOT NULL,
    seq      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (stage_id, mat_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_stage   ON stage_checklist(stage_id);
CREATE INDEX IF NOT EXISTS idx_photo_defs_stage  ON stage_photo_defs(stage_id);
CREATE INDEX IF NOT EXISTS idx_quality_defs_stage ON stage_quality_defs(stage_id);
CREATE INDEX IF NOT EXISTS idx_mat_ids_stage     ON stage_material_ids(stage_id);
CREATE INDEX IF NOT EXISTS idx_payments_stage    ON payments(stage_id);
CREATE INDEX IF NOT EXISTS idx_logs_stage        ON logs(stage_id);
CREATE INDEX IF NOT EXISTS idx_photos_stage      ON photos(stage_id);
"""

# SQLite schema (original)
SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS market_rates (
    id           TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    value        REAL NOT NULL,
    unit         TEXT DEFAULT '',
    category     TEXT DEFAULT 'material',
    notes        TEXT DEFAULT '',
    updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS material_master (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    unit         TEXT NOT NULL,
    required_qty REAL DEFAULT 0,
    color_cat    TEXT DEFAULT 'steel',
    sort_order   INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS team_roles (
    id             TEXT PRIMARY KEY,
    role_name      TEXT NOT NULL,
    default_salary REAL DEFAULT 0,
    sort_order     INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS prereq_master (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL, group_label TEXT NOT NULL,
    group_icon TEXT DEFAULT '📋', item_id TEXT NOT NULL, item_text TEXT NOT NULL, seq INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quality_issues (
    id TEXT PRIMARY KEY, stage_id TEXT NOT NULL, stage_label TEXT DEFAULT '',
    title TEXT NOT NULL, description TEXT DEFAULT '', severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open', assigned_to TEXT DEFAULT '', due_date TEXT DEFAULT '',
    closure_note TEXT DEFAULT '', closure_photo TEXT DEFAULT '',
    ai_detected INTEGER DEFAULT 0, ai_confidence REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS required_photos (
    id TEXT PRIMARY KEY, stage_id TEXT NOT NULL, label TEXT NOT NULL,
    description TEXT DEFAULT '', mandatory INTEGER DEFAULT 1,
    uploaded_at TEXT DEFAULT '', photo_id TEXT DEFAULT '',
    ai_reviewed INTEGER DEFAULT 0, ai_ok INTEGER DEFAULT 0, ai_notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, ts TEXT DEFAULT (datetime('now')), user_id TEXT DEFAULT 'owner',
    action TEXT NOT NULL, entity_type TEXT DEFAULT '', entity_id TEXT DEFAULT '',
    detail TEXT DEFAULT '', stage_id TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS budget_alerts (
    id TEXT PRIMARY KEY, cat_id TEXT NOT NULL, threshold REAL NOT NULL,
    triggered INTEGER DEFAULT 0, triggered_at TEXT DEFAULT '',
    acknowledged INTEGER DEFAULT 0, ack_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS project (
    id TEXT NOT NULL, data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT NOT NULL, user_id TEXT NOT NULL DEFAULT 'default',
    value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (key, user_id)
);
CREATE TABLE IF NOT EXISTS stages (
    stage_id TEXT NOT NULL, task_id TEXT NOT NULL,
    done INTEGER DEFAULT 0, done_date TEXT DEFAULT '',
    PRIMARY KEY (stage_id, task_id)
);
CREATE TABLE IF NOT EXISTS materials (
    mat_id TEXT PRIMARY KEY, ordered REAL DEFAULT 0, received REAL DEFAULT 0,
    rate REAL DEFAULT 0, supplier TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, description TEXT NOT NULL, amount REAL NOT NULL,
    cat_id TEXT NOT NULL, date TEXT NOT NULL, stage_id TEXT DEFAULT '',
    payment_category TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL,
    text TEXT NOT NULL, stage TEXT DEFAULT '', stage_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, src TEXT NOT NULL,
    stage_label TEXT DEFAULT '', stage_id TEXT DEFAULT '',
    date TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS team (
    idx INTEGER PRIMARY KEY, role TEXT NOT NULL, name TEXT DEFAULT '',
    phone TEXT DEFAULT '', salary REAL DEFAULT 0,
    status TEXT DEFAULT 'pending', hired TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT DEFAULT '', email TEXT DEFAULT '',
    phone TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS loan_items (
    item_id TEXT PRIMARY KEY, done INTEGER DEFAULT 0, done_date TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ai_cache (
    cache_key TEXT PRIMARY KEY, stage_id TEXT NOT NULL,
    result TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
);
"""


def _run_pg_migrations() -> None:
    """PostgreSQL migrations — safe to run on every startup (idempotent)."""
    import psycopg2
    conn = _pool.getconn()
    try:
        cur = conn.cursor()
        # Add columns that may not exist on older DBs
        safe_alters = [
            "ALTER TABLE stage_master ADD COLUMN IF NOT EXISTS contract_amount REAL DEFAULT 0",
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS vendor_name TEXT DEFAULT ''",
"""CREATE TABLE IF NOT EXISTS cash_flow (
                id TEXT PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL,
                source TEXT DEFAULT '', amount REAL NOT NULL,
                description TEXT DEFAULT '', stage_id TEXT DEFAULT '',
                ref_number TEXT DEFAULT '', emi_principal REAL DEFAULT 0,
                emi_interest REAL DEFAULT 0, loan_name TEXT DEFAULT '',
                created_at TEXT DEFAULT (NOW()::TEXT)
            )""",
            "ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS emi_principal REAL DEFAULT 0",
            "ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS emi_interest REAL DEFAULT 0",
            "ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS loan_name TEXT DEFAULT ''",
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash'",
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS ref_number TEXT DEFAULT ''",
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_charges REAL DEFAULT 0",
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_charges_desc TEXT DEFAULT ''",
            "ALTER TABLE stage_master ADD COLUMN IF NOT EXISTS payment_rule TEXT DEFAULT ''",
            "ALTER TABLE stage_master ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1",
            "ALTER TABLE kv_store ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default'",
            "ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_category TEXT DEFAULT ''",
        ]
        for sql in safe_alters:
            try:
                cur.execute(sql)
            except Exception:
                pass
        conn.commit()
        logger.info("PostgreSQL migrations complete")
    finally:
        _pool.putconn(conn)


def _migrate_s7_labels() -> None:
    """Update slab stage labels and add s7b."""
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='stage_master'").fetchone()[0] > 0:
            conn.execute("UPDATE stage_master SET label='2nd Slab — Ground Roof (FF Slab)', budget_cat_id='b3b' WHERE id='s5'")
            conn.execute("UPDATE stage_master SET label='3rd Slab — First Roof (SF Slab)', budget_cat_id='b3c' WHERE id='s6'")
            conn.execute("UPDATE stage_master SET label='4th Slab — Second Roof (TF Slab)', budget_cat_id='b3d' WHERE id='s7'")



def _migrate_s0_stage() -> None:
    """Ensure Pre-Construction s0 stage exists in stage_master."""
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='stage_master'").fetchone()[0] == 0:
            return
        exists = conn.execute("SELECT COUNT(*) FROM stage_master WHERE id='s0'").fetchone()[0]
        if not exists:
            # Insert s0 at sort_order -1 so it appears first
            conn.execute(
                """INSERT OR IGNORE INTO stage_master
                   (id, label, icon, color, phase, budget_pct, duration_wks,
                    budget_cat_id, sort_order, contract_amount, payment_rule)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                ("s0", "Pre-Construction: Documents & Approvals", "📋", "#F5A623",
                 "prerequisite", 2.2, 8, "b1", -1, 0,
                 "Outside contract — GVMC fees, legal, NOC fees paid directly by owner (~Rs 3L)")
            )
            logger.info("Migration: s0 Pre-Construction stage inserted")



def _migrate_slab_labels() -> None:
    """Update slab stage labels to use roof-based naming convention."""
    updates = [
        ("s4",  "1st Slab — Stilt Roof (GF Slab)"),
        ("s5",  "2nd Slab — Ground Roof (FF Slab)"),
        ("s6",  "3rd Slab — First Roof (SF Slab)"),
        ("s7",  "4th Slab — Second Roof (TF Slab)"),
        ("s7b", "5th Slab — Terrace + Lift Headroom + OHT"),
    ]
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type=\'table\' AND name=\'stage_master\'").fetchone()[0] > 0:
            for sid, label in updates:
                conn.execute("UPDATE stage_master SET label=? WHERE id=?", (label, sid))

def _migrate_col_pb_budget() -> None:
    """Give Columns & Plinth Beam its own budget category b2b."""
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='stage_master'").fetchone()[0] > 0:
            conn.execute(
                "UPDATE stage_master SET budget_cat_id='b2b', budget_pct=3.7 WHERE id='s_col_pb' AND budget_cat_id='b2'"
            )


def _migrate_borewell_phase() -> None:
    """Move s_borewell from foundation to preparation phase."""
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='stage_master'").fetchone()[0] > 0:
            conn.execute(
                "UPDATE stage_master SET phase='preparation', color='#26A641' WHERE id='s_borewell' AND phase='foundation'"
            )


def run_migrations() -> None:
    """Add columns to existing tables that were created before schema changes."""
    if USE_POSTGRES:
        _run_pg_migrations()
        return
    with db() as conn:
        # Migration: add vendor/payment fields to payments
        pay_cols = [r[1] for r in conn.execute("PRAGMA table_info(payments)").fetchall()]
        # Migration: create cash_flow table
        existing_tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        if 'cash_flow' not in existing_tables:
            conn.execute("""CREATE TABLE IF NOT EXISTS cash_flow (
                id TEXT PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL,
                source TEXT DEFAULT '', amount REAL NOT NULL,
                description TEXT DEFAULT '', stage_id TEXT DEFAULT '',
                ref_number TEXT DEFAULT '', emi_principal REAL DEFAULT 0,
                emi_interest REAL DEFAULT 0, loan_name TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now'))
            )""")
            logger.info("Migration: cash_flow table created")
        else:
            # Add columns if they don't exist (for existing cash_flow tables)
            cf_cols = [r[1] for r in conn.execute("PRAGMA table_info(cash_flow)").fetchall()]
            for col_def in [
                ("emi_principal", "REAL DEFAULT 0"),
                ("emi_interest",  "REAL DEFAULT 0"),
                ("loan_name",     "TEXT DEFAULT ''"),
            ]:
                if col_def[0] not in cf_cols:
                    conn.execute(f"ALTER TABLE cash_flow ADD COLUMN {col_def[0]} {col_def[1]}")
                    logger.info(f"Migration: cash_flow.{col_def[0]} added")

        if 'vendor_name' not in pay_cols:
            conn.execute("ALTER TABLE payments ADD COLUMN vendor_name TEXT DEFAULT ''")
            logger.info("Migration: payments.vendor_name added")
        if 'payment_mode' not in pay_cols:
            conn.execute("ALTER TABLE payments ADD COLUMN payment_mode TEXT DEFAULT 'Cash'")
            logger.info("Migration: payments.payment_mode added")
        if 'ref_number' not in pay_cols:
            conn.execute("ALTER TABLE payments ADD COLUMN ref_number TEXT DEFAULT ''")
            logger.info("Migration: payments.ref_number added")
        if 'bank_charges' not in pay_cols:
            conn.execute("ALTER TABLE payments ADD COLUMN bank_charges REAL DEFAULT 0")
            conn.execute("ALTER TABLE payments ADD COLUMN bank_charges_desc TEXT DEFAULT ''")
            logger.info("Migration: payments.bank_charges added")

        # Migration: add user_id to kv_store if it doesn't exist
        cols = [r[1] for r in conn.execute("PRAGMA table_info(kv_store)").fetchall()]
        if 'user_id' not in cols:
            conn.execute("ALTER TABLE kv_store ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'")
            # Rebuild primary key constraint — SQLite can't ALTER PRIMARY KEY,
            # so we recreate the table
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS kv_store_new (
                    key        TEXT NOT NULL,
                    user_id    TEXT NOT NULL DEFAULT 'default',
                    value      TEXT NOT NULL,
                    updated_at TEXT DEFAULT (datetime('now')),
                    PRIMARY KEY (key, user_id)
                );
                INSERT OR IGNORE INTO kv_store_new(key, user_id, value, updated_at)
                    SELECT key, 'default', value, updated_at FROM kv_store;
                DROP TABLE kv_store;
                ALTER TABLE kv_store_new RENAME TO kv_store;
            """)
            logger.info("Migration: kv_store rebuilt with user_id column")

        # Migration: add user_id to project if it doesn't exist
        cols = [r[1] for r in conn.execute("PRAGMA table_info(project)").fetchall()]
        if 'user_id' not in cols:
            # project table uses id as user_id — existing rows get id='default'
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS project_new (
                    id         TEXT NOT NULL PRIMARY KEY,
                    data       TEXT NOT NULL,
                    updated_at TEXT DEFAULT (datetime('now'))
                );
                INSERT OR IGNORE INTO project_new(id, data, updated_at)
                    SELECT id, data, updated_at FROM project;
                DROP TABLE project;
                ALTER TABLE project_new RENAME TO project;
            """)
            logger.info("Migration: project table schema updated")

        # Migration: add contract_amount + payment_rule to stage_master
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='stage_master'").fetchone()[0] > 0:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(stage_master)").fetchall()]
            if 'contract_amount' not in cols:
                conn.execute("ALTER TABLE stage_master ADD COLUMN contract_amount REAL DEFAULT 0")
                conn.execute("ALTER TABLE stage_master ADD COLUMN payment_rule TEXT DEFAULT ''")
                logger.info("Migration: stage_master got contract_amount + payment_rule columns")


        # Migration: add payment_category to payments
        if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='payments'").fetchone()[0] > 0:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(payments)").fetchall()]
            if 'payment_category' not in cols:
                conn.execute("ALTER TABLE payments ADD COLUMN payment_category TEXT DEFAULT ''")
                logger.info("Migration: payments got payment_category column")

def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    if USE_POSTGRES:
        _init_pool()
        import psycopg2
        conn = _pool.getconn()
        try:
            cur = conn.cursor()
            for stmt in PG_SCHEMA.split(";"):
                stmt = stmt.strip()
                if stmt and not stmt.startswith("--"):
                    try:
                        cur.execute(stmt)
                    except Exception as e:
                        logger.debug(f"Schema: {e}: {stmt[:60]}")
            conn.commit()
        finally:
            _pool.putconn(conn)
        run_migrations()
        logger.info(f"PostgreSQL ready → {DATABASE_URL.split('@')[-1]}")
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        conn_raw = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn_raw.executescript(SCHEMA)
        conn_raw.commit()
        conn_raw.close()
        run_migrations()
        logger.info(f"SQLite ready at {DB_PATH}")

def save_project(project: Dict, user_id: str = 'default') -> Dict:
    data = json.dumps(project, ensure_ascii=False)
    with db() as conn:
        conn.execute(
            "INSERT INTO project(id, data, updated_at) VALUES(?, ?, datetime('now')) "
            "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
            (user_id, data)
        )
    return project


def load_project(user_id: str = 'default') -> Optional[Dict]:
    with db() as conn:
        row = conn.execute("SELECT data FROM project WHERE id=?", (user_id,)).fetchone()
    return json.loads(row["data"]) if row else None


# ── Generic KV store ──────────────────────────────────────────────────────────

def save_storage(key: str, value: Any, user_id: str = 'default') -> Any:
    with db() as conn:
        conn.execute(
            "INSERT INTO kv_store(key, user_id, value, updated_at) VALUES(?, ?, ?, datetime('now')) "
            "ON CONFLICT(key, user_id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, user_id, json.dumps(value, ensure_ascii=False))
        )
    return value


def load_storage(key: str, default: Any = None, user_id: str = 'default') -> Any:
    with db() as conn:
        row = conn.execute(
            "SELECT value FROM kv_store WHERE key=? AND user_id=?", (key, user_id)
        ).fetchone()
    if row is None:
        return default
    try:
        return json.loads(row["value"])
    except Exception:
        return default


# ── Stages ────────────────────────────────────────────────────────────────────

def save_stage_tasks(tasks: List[Dict]) -> None:
    """Upsert stage task completion records."""
    with db() as conn:
        for t in tasks:
            conn.execute(
                "INSERT INTO stages(stage_id, task_id, done, done_date) VALUES(?,?,?,?) "
                "ON CONFLICT(stage_id, task_id) DO UPDATE SET done=excluded.done, done_date=excluded.done_date",
                (t.get("stageId",""), t["id"], 1 if t.get("done") else 0, t.get("doneDate",""))
            )


def load_stage_tasks() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM stages").fetchall()
    return [dict(r) for r in rows]


# ── Materials ─────────────────────────────────────────────────────────────────

def save_materials(mats: List[Dict]) -> None:
    with db() as conn:
        for m in mats:
            conn.execute(
                "INSERT INTO materials(mat_id, ordered, received, rate, supplier) VALUES(?,?,?,?,?) "
                "ON CONFLICT(mat_id) DO UPDATE SET ordered=excluded.ordered, received=excluded.received, "
                "rate=excluded.rate, supplier=excluded.supplier",
                (m["id"], m.get("ordered",0), m.get("received",0), m.get("rate",0), m.get("supplier",""))
            )


def load_materials() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM materials").fetchall()
    return [dict(r) for r in rows]


# ── Payments ──────────────────────────────────────────────────────────────────

def save_payment(pay: Dict) -> None:
    with db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO payments
               (id, description, amount, cat_id, date, stage_id,
                payment_category, vendor_name, payment_mode, ref_number,
                bank_charges, bank_charges_desc)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pay["id"],
             pay.get("description") or pay.get("desc",""),
             pay.get("amount", 0),
             pay.get("cat_id") or pay.get("catId",""),
             pay.get("date",""),
             pay.get("stage_id") or pay.get("stageId",""),
             pay.get("payment_category") or pay.get("paymentCategory",""),
             pay.get("vendor_name",""),
             pay.get("payment_mode","Cash"),
             pay.get("ref_number",""),
             pay.get("bank_charges", 0) or 0,
             pay.get("bank_charges_desc",""))
        )


def delete_payment(pay_id: str) -> None:
    with db() as conn:
        conn.execute("DELETE FROM payments WHERE id=?", (pay_id,))


def load_payments() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM payments ORDER BY date DESC, created_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        # Normalise key names so frontend works with both styles
        d["desc"]            = d.get("description","")
        d["catId"]           = d.get("cat_id","")
        d["stageId"]         = d.get("stage_id","")
        d["paymentCategory"] = d.get("payment_category","")
        d["vendor_name"]     = d.get("vendor_name","")
        d["payment_mode"]    = d.get("payment_mode","Cash")
        d["ref_number"]      = d.get("ref_number","")
        d["bank_charges"]    = d.get("bank_charges", 0) or 0
        d["bank_charges_desc"] = d.get("bank_charges_desc","")
        result.append(d)
    return result


# ── Logs ──────────────────────────────────────────────────────────────────────

def save_log(entry: Dict) -> None:
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO logs(id, date, time, text, stage, stage_id) VALUES(?,?,?,?,?,?)",
            (entry["id"], entry.get("date",""), entry.get("time",""),
             entry.get("text",""), entry.get("stage",""), entry.get("stageId",""))
        )


def load_logs() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM logs ORDER BY created_at DESC LIMIT 200").fetchall()
    return [dict(r) for r in rows]


# ── Photos ────────────────────────────────────────────────────────────────────

def save_photo(photo: Dict) -> None:
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO photos(id, name, src, stage_label, stage_id, date) VALUES(?,?,?,?,?,?)",
            (photo["id"], photo.get("name",""), photo.get("src",""),
             photo.get("stageLabel",""), photo.get("stageId",""), photo.get("date",""))
        )


def load_photos() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM photos ORDER BY created_at DESC LIMIT 100").fetchall()
    return [
        {"id": r["id"], "name": r["name"], "src": r["src"],
         "stageLabel": r["stage_label"], "stageId": r["stage_id"], "date": r["date"]}
        for r in rows
    ]


# ── Team ──────────────────────────────────────────────────────────────────────

def save_team(team: List[Dict]) -> None:
    with db() as conn:
        conn.execute("DELETE FROM team")
        for i, m in enumerate(team):
            conn.execute(
                "INSERT INTO team(idx, role, name, phone, salary, status, hired) VALUES(?,?,?,?,?,?,?)",
                (i, m.get("role",""), m.get("name",""), m.get("phone",""),
                 m.get("salary",0), m.get("status","pending"), m.get("hired",""))
            )


def load_team() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM team ORDER BY idx").fetchall()
    return [
        {"id": f"t{r['idx']+1}", "role": r["role"], "name": r["name"],
         "phone": r["phone"], "salary": r["salary"], "status": r["status"], "hired": r["hired"]}
        for r in rows
    ]


# ── Customers ─────────────────────────────────────────────────────────────────

def save_customer(c: Dict) -> None:
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO customers(id, name, email, phone) VALUES(?,?,?,?)",
            (c.get("id",""), c.get("name",""), c.get("email",""), c.get("phone",""))
        )


def load_customers() -> List[Dict]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM customers ORDER BY created_at").fetchall()
    return [dict(r) for r in rows]


# ── Loan items ────────────────────────────────────────────────────────────────

def save_loan_items(items: Dict) -> None:
    with db() as conn:
        for item_id, state in items.items():
            conn.execute(
                "INSERT INTO loan_items(item_id, done, done_date) VALUES(?,?,?) "
                "ON CONFLICT(item_id) DO UPDATE SET done=excluded.done, done_date=excluded.done_date",
                (item_id, 1 if state.get("done") else 0, state.get("doneDate",""))
            )


def load_loan_items() -> Dict:
    with db() as conn:
        rows = conn.execute("SELECT * FROM loan_items").fetchall()
    return {r["item_id"]: {"done": bool(r["done"]), "doneDate": r["done_date"]} for r in rows}


# ── AI cache ──────────────────────────────────────────────────────────────────

def _cache_key(stage_id: str, project: Dict) -> str:
    sig = f"{stage_id}|{project.get('plotLength')}|{project.get('plotWidth')}|{project.get('totalFloors')}"
    return hashlib.md5(sig.encode()).hexdigest()


def get_ai_cache(stage_id: str, project: Dict) -> Optional[Dict]:
    key = _cache_key(stage_id, project)
    with db() as conn:
        row = conn.execute(
            "SELECT result FROM ai_cache WHERE cache_key=? "
            "AND created_at > datetime('now', '-7 days')",  # 7-day TTL
            (key,)
        ).fetchone()
    if row:
        try:
            return json.loads(row["result"])
        except Exception:
            return None
    return None


def set_ai_cache(stage_id: str, project: Dict, result: Dict) -> None:
    key = _cache_key(stage_id, project)
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ai_cache(cache_key, stage_id, result, created_at) VALUES(?,?,?,datetime('now'))",
            (key, stage_id, json.dumps(result, ensure_ascii=False))
        )


# ── Quality Issues ────────────────────────────────────────────────────────────

def save_issue(issue: dict) -> None:
    with db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO quality_issues
               (id, stage_id, stage_label, title, description, severity, status,
                assigned_to, due_date, closure_note, closure_photo,
                ai_detected, ai_confidence, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))""",
            (issue['id'], issue.get('stageId',''), issue.get('stageLabel',''),
             issue.get('title',''), issue.get('description',''),
             issue.get('severity','medium'), issue.get('status','open'),
             issue.get('assignedTo',''), issue.get('dueDate',''),
             issue.get('closureNote',''), issue.get('closurePhoto',''),
             1 if issue.get('aiDetected') else 0,
             float(issue.get('aiConfidence',0)))
        )


def load_issues(stage_id: str = None) -> list:
    with db() as conn:
        if stage_id:
            rows = conn.execute(
                "SELECT * FROM quality_issues WHERE stage_id=? ORDER BY created_at DESC", (stage_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM quality_issues ORDER BY created_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


def delete_issue(issue_id: str) -> None:
    with db() as conn:
        conn.execute("DELETE FROM quality_issues WHERE id=?", (issue_id,))


# ── Required photos ───────────────────────────────────────────────────────────

def save_required_photo(rp: dict) -> None:
    with db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO required_photos
               (id, stage_id, label, description, mandatory, uploaded_at,
                photo_id, ai_reviewed, ai_ok, ai_notes)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (rp['id'], rp['stageId'], rp['label'], rp.get('description',''),
             1 if rp.get('mandatory',True) else 0,
             rp.get('uploadedAt',''), rp.get('photoId',''),
             1 if rp.get('aiReviewed') else 0,
             1 if rp.get('aiOk') else 0,
             rp.get('aiNotes',''))
        )


def load_required_photos(stage_id: str) -> list:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM required_photos WHERE stage_id=? ORDER BY rowid", (stage_id,)
        ).fetchall()
    return [dict(r) for r in rows]


# ── Audit log ─────────────────────────────────────────────────────────────────

def audit(action: str, entity_type: str = '', entity_id: str = '',
          detail: str = '', stage_id: str = '', user_id: str = 'owner') -> None:
    import uuid
    with db() as conn:
        conn.execute(
            "INSERT INTO audit_log(id,ts,user_id,action,entity_type,entity_id,detail,stage_id) "
            "VALUES (?,datetime('now'),?,?,?,?,?,?)",
            (str(uuid.uuid4()), user_id, action, entity_type, entity_id, detail, stage_id)
        )


def load_audit_log(limit: int = 100, stage_id: str = None) -> list:
    with db() as conn:
        if stage_id:
            rows = conn.execute(
                "SELECT * FROM audit_log WHERE stage_id=? ORDER BY ts DESC LIMIT ?",
                (stage_id, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?", (limit,)
            ).fetchall()
    return [dict(r) for r in rows]


# ── Budget alerts ─────────────────────────────────────────────────────────────

def check_and_save_budget_alert(cat_id: str, pct_used: float) -> Optional[dict]:
    """Check if a new threshold is crossed; return alert dict if yes."""
    thresholds = [80.0, 95.0, 100.0]
    triggered  = [t for t in thresholds if pct_used >= t]
    if not triggered:
        return None
    highest = max(triggered)
    with db() as conn:
        existing = conn.execute(
            "SELECT * FROM budget_alerts WHERE cat_id=? AND threshold=? AND triggered=1",
            (cat_id, highest)
        ).fetchone()
        if existing:
            return None                     # already fired this threshold
        import uuid
        conn.execute(
            "INSERT OR REPLACE INTO budget_alerts(id, cat_id, threshold, triggered, triggered_at) "
            "VALUES (?,?,?,1,datetime('now'))",
            (str(uuid.uuid4()), cat_id, highest)
        )
    return {'catId': cat_id, 'threshold': highest, 'pctUsed': pct_used}


def load_budget_alerts(unack_only: bool = True) -> list:
    with db() as conn:
        if unack_only:
            rows = conn.execute(
                "SELECT * FROM budget_alerts WHERE triggered=1 AND acknowledged=0 ORDER BY triggered_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM budget_alerts WHERE triggered=1 ORDER BY triggered_at DESC LIMIT 50"
            ).fetchall()
    return [dict(r) for r in rows]


def ack_budget_alert(alert_id: str) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE budget_alerts SET acknowledged=1, ack_at=datetime('now') WHERE id=?",
            (alert_id,)
        )


# ── Stage Estimates (user-confirmed material + cost estimates per stage) ──────

def init_stage_tables() -> None:
    with db() as conn:
        conn.executescript("""
CREATE TABLE IF NOT EXISTS stage_estimates (
    stage_id       TEXT PRIMARY KEY,
    estimated_cost REAL DEFAULT 0,
    items_json     TEXT DEFAULT '[]',   -- JSON array of {id,name,unit,qty,rate,amount}
    source         TEXT DEFAULT 'local', -- 'local' | 'ai'
    saved_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stage_mat_actuals (
    id          TEXT PRIMARY KEY,       -- e.g. 's2_m1'
    stage_id    TEXT NOT NULL,
    item_id     TEXT NOT NULL,          -- matches id in stage_estimates items_json
    item_name   TEXT DEFAULT '',
    unit        TEXT DEFAULT '',
    actual_qty  REAL DEFAULT 0,
    actual_rate REAL DEFAULT 0,
    actual_amt  REAL DEFAULT 0,
    notes       TEXT DEFAULT '',
    updated_at  TEXT DEFAULT (datetime('now'))
);
""")


def save_stage_estimate(stage_id: str, estimated_cost: float,
                         items: list, source: str = 'local') -> None:
    import json
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO stage_estimates"
            "(stage_id, estimated_cost, items_json, source, saved_at) "
            "VALUES (?,?,?,?,datetime('now'))",
            (stage_id, estimated_cost, json.dumps(items, ensure_ascii=False), source)
        )


def load_stage_estimate(stage_id: str) -> Optional[dict]:
    import json
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM stage_estimates WHERE stage_id=?", (stage_id,)
        ).fetchone()
    if not row:
        return None
    try:
        items = json.loads(row['items_json'])
    except Exception:
        items = []
    return {
        'stageId':       row['stage_id'],
        'estimatedCost': row['estimated_cost'],
        'items':         items,
        'source':        row['source'],
        'savedAt':       row['saved_at'],
    }


def save_mat_actual(stage_id: str, item_id: str, data: dict) -> None:
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO stage_mat_actuals"
            "(id, stage_id, item_id, item_name, unit, actual_qty, actual_rate,"
            " actual_amt, notes, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))",
            (
                f"{stage_id}_{item_id}",
                stage_id,
                item_id,
                data.get('itemName', ''),
                data.get('unit', ''),
                float(data.get('actualQty', 0)),
                float(data.get('actualRate', 0)),
                float(data.get('actualAmt', 0)),
                data.get('notes', ''),
            )
        )


def load_mat_actuals(stage_id: str) -> dict:
    """Returns dict keyed by item_id."""
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM stage_mat_actuals WHERE stage_id=?", (stage_id,)
        ).fetchall()
    return {
        r['item_id']: {
            'actualQty':  r['actual_qty'],
            'actualRate': r['actual_rate'],
            'actualAmt':  r['actual_amt'],
            'notes':      r['notes'],
            'updatedAt':  r['updated_at'],
        }
        for r in rows
    }


# ════════════════════════════════════════════════════════════════════════════
# STAGE MASTER TABLES
# ════════════════════════════════════════════════════════════════════════════

STAGE_MASTER_SCHEMA = """
CREATE TABLE IF NOT EXISTS stage_master (
    id           TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    icon         TEXT DEFAULT '🏗',
    color        TEXT DEFAULT '#3D7EFF',
    phase        TEXT DEFAULT 'foundation',
    budget_pct   REAL DEFAULT 0,
    duration_wks INTEGER DEFAULT 4,
    budget_cat_id TEXT DEFAULT '',
    sort_order      INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    contract_amount REAL DEFAULT 0,
    payment_rule    TEXT DEFAULT '',
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stage_checklist (
    id           TEXT PRIMARY KEY,   -- e.g. 's1_0'
    stage_id     TEXT NOT NULL,
    seq          INTEGER NOT NULL,
    text         TEXT NOT NULL,
    is_active    INTEGER DEFAULT 1,
    FOREIGN KEY (stage_id) REFERENCES stage_master(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stage_photo_defs (
    id           TEXT PRIMARY KEY,   -- e.g. 'bw_rig'
    stage_id     TEXT NOT NULL,
    seq          INTEGER NOT NULL,
    label        TEXT NOT NULL,
    description  TEXT DEFAULT '',
    mandatory    INTEGER DEFAULT 1,
    FOREIGN KEY (stage_id) REFERENCES stage_master(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stage_quality_defs (
    id           TEXT PRIMARY KEY,   -- e.g. 'bwq1'
    stage_id     TEXT NOT NULL,
    seq          INTEGER NOT NULL,
    check_text   TEXT NOT NULL,
    severity     TEXT DEFAULT 'medium',
    FOREIGN KEY (stage_id) REFERENCES stage_master(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stage_material_ids (
    stage_id     TEXT NOT NULL,
    mat_id       TEXT NOT NULL,
    seq          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (stage_id, mat_id),
    FOREIGN KEY (stage_id) REFERENCES stage_master(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklist_stage ON stage_checklist(stage_id);
CREATE INDEX IF NOT EXISTS idx_photo_defs_stage ON stage_photo_defs(stage_id);
CREATE INDEX IF NOT EXISTS idx_quality_defs_stage ON stage_quality_defs(stage_id);
CREATE INDEX IF NOT EXISTS idx_mat_ids_stage ON stage_material_ids(stage_id);
"""


def init_stage_master_tables() -> None:
    with db() as conn:
        conn.executescript(STAGE_MASTER_SCHEMA)


def _stage_master_seeded(conn) -> bool:
    row = conn.execute("SELECT COUNT(*) as n FROM stage_master").fetchone()
    return row["n"] > 0


def seed_stage_master(stages_data: list) -> None:
    """Seed stage master tables. Re-seeds if the count in DB doesn't match the seed list."""
    with db() as conn:
        if _stage_master_seeded(conn):
            # Check if count matches — if not, data is stale, re-seed
            db_count = conn.execute("SELECT COUNT(*) FROM stage_master").fetchone()[0]
            if db_count >= len(stages_data):
                return  # up to date
            # Stale — clear and re-seed
            conn.executescript("""
                DELETE FROM stage_material_ids;
                DELETE FROM stage_quality_defs;
                DELETE FROM stage_photo_defs;
                DELETE FROM stage_checklist;
                DELETE FROM stage_master;
            """)
            logger.info(f"Re-seeding stage_master: DB had {db_count}, seed has {len(stages_data)}")

        for order, s in enumerate(stages_data):
            # stage_master
            conn.execute(
                """INSERT OR IGNORE INTO stage_master
                   (id, label, icon, color, phase, budget_pct, duration_wks,
                    budget_cat_id, sort_order, contract_amount, payment_rule)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (s["id"], s["label"], s.get("icon","🏗"), s.get("color","#3D7EFF"),
                 s.get("phase","foundation"), s.get("budgetPct",0),
                 s.get("durationWks",4), s.get("budgetCatId",""), order,
                 s.get("contractAmount",0), s.get("paymentRule",""))
            )
            # checklist items
            for seq, text in enumerate(s.get("checklist", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_checklist(id, stage_id, seq, text) VALUES (?,?,?,?)",
                    (f"{s['id']}_{seq}", s["id"], seq, text)
                )
            # required photos
            for seq, rp in enumerate(s.get("requiredPhotos", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_photo_defs(id, stage_id, seq, label, description, mandatory) VALUES (?,?,?,?,?,?)",
                    (rp["id"], s["id"], seq, rp["label"], rp.get("description",""), 1 if rp.get("mandatory",True) else 0)
                )
            # quality checks
            for seq, qc in enumerate(s.get("qualityChecks", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_quality_defs(id, stage_id, seq, check_text, severity) VALUES (?,?,?,?,?)",
                    (qc["id"], s["id"], seq, qc["check"], qc.get("severity","medium"))
                )
            # material ids
            for seq, mid in enumerate(s.get("materialIds", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_material_ids(stage_id, mat_id, seq) VALUES (?,?,?)",
                    (s["id"], mid, seq)
                )


# ── CRUD helpers ──────────────────────────────────────────────────────────────

def load_stage_master() -> list:
    """Load all stages with their checklist, photos, quality checks, material ids."""
    with db() as conn:
        stages = conn.execute(
            "SELECT * FROM stage_master WHERE is_active=1 ORDER BY sort_order"
        ).fetchall()

        result = []
        for s in stages:
            sid = s["id"]

            checklist = conn.execute(
                "SELECT text FROM stage_checklist WHERE stage_id=? AND is_active=1 ORDER BY seq", (sid,)
            ).fetchall()

            photos = conn.execute(
                "SELECT id, label, description, mandatory FROM stage_photo_defs WHERE stage_id=? ORDER BY seq", (sid,)
            ).fetchall()

            quality = conn.execute(
                "SELECT id, check_text, severity FROM stage_quality_defs WHERE stage_id=? ORDER BY seq", (sid,)
            ).fetchall()

            mats = conn.execute(
                "SELECT mat_id FROM stage_material_ids WHERE stage_id=? ORDER BY seq", (sid,)
            ).fetchall()

            result.append({
                "id":           s["id"],
                "label":        s["label"],
                "icon":         s["icon"],
                "color":        s["color"],
                "phase":        s["phase"],
                "budgetPct":    s["budget_pct"],
                "durationWks":  s["duration_wks"],
                "budgetCatId":  s["budget_cat_id"],
                "sortOrder":    s["sort_order"],
                "checklist":    [r["text"] for r in checklist],
                "requiredPhotos": [{"id": r["id"], "label": r["label"], "description": r["description"], "mandatory": bool(r["mandatory"])} for r in photos],
                "qualityChecks":  [{"id": r["id"], "check": r["check_text"], "severity": r["severity"]} for r in quality],
                "materialIds":    [r["mat_id"] for r in mats],
                "contractAmount": s["contract_amount"],
                "paymentRule":    s["payment_rule"],
            })
    return result


def save_stage(stage: dict) -> dict:
    """Upsert a single stage master record."""
    with db() as conn:
        conn.execute(
            """INSERT INTO stage_master (id, label, icon, color, phase, budget_pct,
               duration_wks, budget_cat_id, sort_order, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
               ON CONFLICT(id) DO UPDATE SET
                 label=excluded.label, icon=excluded.icon, color=excluded.color,
                 phase=excluded.phase, budget_pct=excluded.budget_pct,
                 duration_wks=excluded.duration_wks, budget_cat_id=excluded.budget_cat_id,
                 sort_order=excluded.sort_order, updated_at=datetime('now')""",
            (stage["id"], stage["label"], stage.get("icon","🏗"), stage.get("color","#3D7EFF"),
             stage.get("phase","foundation"), stage.get("budgetPct",0),
             stage.get("durationWks",4), stage.get("budgetCatId",""), stage.get("sortOrder",0))
        )
        # Replace checklist if provided
        if "checklist" in stage:
            conn.execute("DELETE FROM stage_checklist WHERE stage_id=?", (stage["id"],))
            for seq, text in enumerate(stage["checklist"]):
                conn.execute(
                    "INSERT INTO stage_checklist(id, stage_id, seq, text) VALUES (?,?,?,?)",
                    (f"{stage['id']}_{seq}", stage["id"], seq, text)
                )
    return stage


def delete_stage(stage_id: str) -> None:
    """Soft-delete a stage (set is_active=0)."""
    with db() as conn:
        conn.execute("UPDATE stage_master SET is_active=0 WHERE id=?", (stage_id,))


def reorder_stages(ordered_ids: list) -> None:
    """Update sort_order for all stages."""
    with db() as conn:
        for i, sid in enumerate(ordered_ids):
            conn.execute("UPDATE stage_master SET sort_order=? WHERE id=?", (i, sid))


def reset_stage_master() -> None:
    """Delete all stage master data so it can be re-seeded. Use via API endpoint."""
    with db() as conn:
        conn.executescript("""
DELETE FROM stage_material_ids;
DELETE FROM stage_quality_defs;
DELETE FROM stage_photo_defs;
DELETE FROM stage_checklist;
DELETE FROM stage_master;
""")


# ── Config master CRUD + seeding ──────────────────────────────────────────────

MARKET_RATES_SEED = [
    # id, label, value, unit, category, notes
    ("steel20",     "Steel 20mm TMT (VSP/Simhadri)",   58000, "per MT",  "steel",   "Column + beam main bars"),
    ("steel16",     "Steel 16mm TMT",                  58000, "per MT",  "steel",   "Upper floor column bars"),
    ("steel12",     "Steel 12mm TMT",                  57000, "per MT",  "steel",   "Slab main bars"),
    ("steel10",     "Steel 10mm TMT",                  57000, "per MT",  "steel",   "Stirrups and ties"),
    ("steel8",      "Steel 8mm TMT",                   56000, "per MT",  "steel",   "Distribution bars"),
    ("opc53",       "OPC 53 Grade Cement (Ramco/Priya/Maha)", 390, "per bag", "cement", "RCC work"),
    ("ppc",         "PPC Cement (Ramco/Priya/Maha)",   360,  "per bag",  "cement",  "Masonry + plastering"),
    ("sand",        "River Sand (Zone 2)",              1800, "per cum",  "aggregate","Screened, silt <8%"),
    ("agg20",       "Aggregate 20mm HBG",               1200, "per cum", "aggregate","For M25/M20 RCC"),
    ("agg40",       "Aggregate 40mm HBG",               1000, "per cum", "aggregate","For PCC 1:4:8"),
    ("bricks",      "Red Bricks 9×4.5×3 in",           9,    "per nos",  "masonry", "IS 1077 Class designation"),
    ("tiles2x4",    "Gujarat Tiles 2×4ft (Double charge vitrified)", 900, "per sqm", "finishing", "Rooms + corridors + balcony"),
    ("tiles2x2",    "Gujarat Tiles 2×2ft (Bathroom)",  800,  "per sqm",  "finishing","Anti-skid bathroom floor"),
    ("granite",     "Granite Blackberry/Steel Gray",    2200, "per sqm",  "finishing","Kitchen + staircase + corridors"),
    ("pcc148",      "PCC 1:4:8 (labour+material)",      3200, "per cum",  "civil",   "150mm bed under footings"),
    ("labourExcav", "Excavation labour",                200,  "per cum",  "labour",  "Earth removal in hard soil"),
    ("labourMasonry","Brick masonry labour",            18,   "per cft",  "labour",  "CM 1:6 laying rate"),
    ("labourPlaster","Plastering labour",               22,   "per sft",  "labour",  "Internal + external"),
    ("labourRCC",   "RCC slab labour",                  45,   "per sft",  "labour",  "Bar bending + pour"),
    ("labourTiling","Tile laying labour",               35,   "per sft",  "labour",  "Cutting + fixing"),
]

MATERIAL_MASTER_SEED = [
    ("m1",  "Steel 20mm TMT",  "MT",   9.8,   "steel",  1),
    ("m2",  "Steel 16mm TMT",  "MT",   4.2,   "steel",  2),
    ("m3",  "Steel 12mm TMT",  "MT",   14.0,  "steel",  3),
    ("m4",  "Steel 10mm TMT",  "MT",   6.5,   "steel",  4),
    ("m5",  "Steel 8mm TMT",   "MT",   7.3,   "steel",  5),
    ("m6",  "OPC 53 Cement",   "bags", 2288,  "cement", 6),
    ("m7",  "PPC Cement",      "bags", 1493,  "cement", 7),
    ("m8",  "River Sand",      "cum",  608,   "aggregate", 8),
    ("m9",  "Aggregate 20mm",  "cum",  166,   "aggregate", 9),
    ("m10", "Aggregate 40mm",  "cum",  6,     "aggregate", 10),
    ("m11", "Red Bricks",      "nos",  93270, "masonry", 11),
    ("m12", "Flooring Tiles",  "boxes",420,   "finishing", 12),
    ("m13", "Bathroom Tiles",  "boxes",180,   "finishing", 13),
]

TEAM_ROLES_SEED = [
    ("tr1", "Site Supervisor",    30000, 1),
    ("tr2", "Watchman (live-in)", 9000,  2),
    ("tr3", "RCC Contractor",     0,     3),
    ("tr4", "Mason Contractor",   0,     4),
    ("tr5", "Plumber",            0,     5),
    ("tr6", "Electrician",        0,     6),
    ("tr7", "Tile Contractor",    0,     7),
    ("tr8", "Painter",            0,     8),
]


def seed_config_master() -> None:
    """Seed market rates, material master, team roles from Python defaults if tables are empty."""
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM market_rates").fetchone()[0] == 0:
            conn.executemany(
                "INSERT OR IGNORE INTO market_rates(id,label,value,unit,category,notes) VALUES(?,?,?,?,?,?)",
                MARKET_RATES_SEED
            )
        if conn.execute("SELECT COUNT(*) FROM material_master").fetchone()[0] == 0:
            conn.executemany(
                "INSERT OR IGNORE INTO material_master(id,name,unit,required_qty,color_cat,sort_order) VALUES(?,?,?,?,?,?)",
                MATERIAL_MASTER_SEED
            )
        if conn.execute("SELECT COUNT(*) FROM team_roles").fetchone()[0] == 0:
            conn.executemany(
                "INSERT OR IGNORE INTO team_roles(id,role_name,default_salary,sort_order) VALUES(?,?,?,?)",
                TEAM_ROLES_SEED
            )


def load_market_rates() -> dict:
    """Returns dict keyed by rate id, e.g. {'steel20': 58000, ...}"""
    with db() as conn:
        rows = conn.execute("SELECT id, value FROM market_rates").fetchall()
    return {r["id"]: r["value"] for r in rows}


def load_market_rates_full() -> list:
    with db() as conn:
        rows = conn.execute("SELECT * FROM market_rates ORDER BY category, id").fetchall()
    return [dict(r) for r in rows]


def save_market_rate(rate_id: str, value: float) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE market_rates SET value=?, updated_at=datetime('now') WHERE id=?",
            (value, rate_id)
        )


def load_material_master() -> list:
    with db() as conn:
        rows = conn.execute("SELECT * FROM material_master ORDER BY sort_order").fetchall()
    return [dict(r) for r in rows]


def load_team_roles() -> list:
    with db() as conn:
        rows = conn.execute("SELECT * FROM team_roles ORDER BY sort_order").fetchall()
    return [dict(r) for r in rows]


# ── Cash flow (deposits) CRUD ─────────────────────────────────────────────────

def save_cash_flow(entry: Dict) -> Dict:
    """Save a cash flow entry (own funds deposit or loan disbursement)."""
    if not entry.get('id'):
        entry['id'] = f"cf_{int(__import__('time').time() * 1000)}"
    with db() as conn:
        conn.execute(
            """INSERT INTO cash_flow
               (id, date, type, source, amount, description, stage_id,
                ref_number, payment_mode)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               date=excluded.date, type=excluded.type, source=excluded.source,
               amount=excluded.amount, description=excluded.description,
               stage_id=excluded.stage_id, ref_number=excluded.ref_number,
               payment_mode=excluded.payment_mode""",
            (entry['id'], entry['date'], entry['type'],
             entry.get('source', ''),
             float(entry.get('amount', 0) or 0),
             entry.get('description', ''),
             entry.get('stage_id', ''),
             entry.get('ref_number', ''),
             entry.get('payment_mode', 'Cash'))
        )
    return entry


def load_cash_flow() -> List[Dict]:
    """Load all cash flow entries ordered by date."""
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM cash_flow ORDER BY date DESC, created_at DESC"
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['payment_mode'] = d.get('payment_mode', 'Cash') or 'Cash'
        result.append(d)
    return result


def delete_cash_flow(entry_id: str) -> None:
    with db() as conn:
        conn.execute("DELETE FROM cash_flow WHERE id=?", (entry_id,))


# ── Money Out (non-construction outflows) CRUD ────────────────────────────────

MONEY_OUT_CATEGORIES = [
    ('bank_charges',  'Bank Charges & Processing Fees'),
    ('emi',           'EMI / Loan Repayment'),
    ('valuation_fee', 'Valuation / Inspection Fee'),
    ('engineer_fee',  'Structural / Civil Engineer Fee'),
    ('legal_fee',     'Legal & Documentation Charges'),
    ('insurance',     'Insurance Premium'),
    ('tax',           'Property Tax / Government Dues'),
    ('other',         'Other Expenses'),
]


def save_money_out(entry: Dict) -> Dict:
    """Insert or update a money-out entry (bank charges, EMI, fees etc.)."""
    if not entry.get('id'):
        import time as _time
        entry['id'] = f"mo_{int(_time.time() * 1000)}"
    with db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO money_out
               (id, date, category, description, amount,
                vendor_name, payment_mode, ref_number, loan_account)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (entry['id'],
             entry.get('date', ''),
             entry.get('category', 'other'),
             entry.get('description', ''),
             float(entry.get('amount', 0) or 0),
             entry.get('vendor_name', ''),
             entry.get('payment_mode', 'Cash'),
             entry.get('ref_number', ''),
             entry.get('loan_account', ''))
        )
    return entry


def load_money_out() -> List[Dict]:
    """Load all money-out entries ordered by date descending."""
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM money_out ORDER BY date DESC, created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def delete_money_out(entry_id: str) -> None:
    """Delete a money-out entry by id."""
    with db() as conn:
        conn.execute("DELETE FROM money_out WHERE id=?", (entry_id,))
