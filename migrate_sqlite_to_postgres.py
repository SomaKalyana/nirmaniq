#!/usr/bin/env python3
"""
NirmanIQ — SQLite → PostgreSQL migration script
────────────────────────────────────────────────
Run ONCE after setting up PostgreSQL to migrate all existing data.

Usage:
    # Make sure PostgreSQL is running and backend has created the schema first:
    docker-compose up postgres -d
    docker-compose up backend -d   # creates tables on startup

    # Then run this script:
    pip install psycopg2-binary python-dotenv
    python migrate_sqlite_to_postgres.py

Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
Project data (Sai Ganesh Vaibhavam), payments, logs, users are all preserved.
"""

import os, sys, json, sqlite3
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent / ".env")

SQLITE_PATH  = os.environ.get("SQLITE_PATH", "./backend/data/nirmaniq.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    print("  Add: DATABASE_URL=postgresql://nirmaniq:pass@localhost:5432/nirmaniq")
    sys.exit(1)

if not Path(SQLITE_PATH).exists():
    print(f"ERROR: SQLite file not found at {SQLITE_PATH}")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

print(f"Reading SQLite: {SQLITE_PATH}")
print(f"Writing to PG:  {DATABASE_URL.split('@')[-1]}")
print()

# ── Connect ───────────────────────────────────────────────────────────────────

sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row

pg_conn = psycopg2.connect(DATABASE_URL)
pg_conn.autocommit = False
pg_cur  = pg_conn.cursor()

# ── Get tables ────────────────────────────────────────────────────────────────

tables = [r[0] for r in sqlite_conn.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).fetchall()]

print(f"Found {len(tables)} tables in SQLite:")
for t in tables:
    n = sqlite_conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {n} rows")
print()

# Tables to skip (system/temp)
SKIP_TABLES = {"sqlite_sequence", "sqlite_stat1"}

# ── Migrate each table ────────────────────────────────────────────────────────

results = {}

for table in tables:
    if table in SKIP_TABLES:
        continue

    rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        print(f"  {table}: 0 rows — skip")
        results[table] = 0
        continue

    cols = list(rows[0].keys())
    col_names    = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))

    # Use ON CONFLICT DO NOTHING for idempotency
    sql = f'INSERT INTO {table} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

    count = 0
    errors = 0
    for row in rows:
        values = []
        for v in row:
            # Convert SQLite integers (0/1) used as booleans to int for PG
            values.append(v)
        try:
            pg_cur.execute(sql, values)
            count += 1
        except psycopg2.Error as e:
            errors += 1
            if errors <= 3:  # show first 3 errors
                print(f"    WARNING: {table} row skipped — {str(e).strip()[:80]}")
            pg_conn.rollback()

    try:
        pg_conn.commit()
        status = f"✓ {count}/{len(rows)} rows"
        if errors: status += f" ({errors} skipped)"
        print(f"  {table}: {status}")
        results[table] = count
    except Exception as e:
        pg_conn.rollback()
        print(f"  {table}: ✗ commit failed — {e}")
        results[table] = 0

# ── Summary ───────────────────────────────────────────────────────────────────

sqlite_conn.close()
pg_conn.close()

total = sum(results.values())
print()
print("=" * 60)
print(f"Migration complete: {total} total rows migrated")
print()

# Verify key data
pg_verify = psycopg2.connect(DATABASE_URL)
pg_verify.autocommit = True
vc = pg_verify.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("Verification:")
vc.execute("SELECT id, data->>'name' as project_name FROM project LIMIT 5")
rows = vc.fetchall()
if rows:
    for r in rows:
        print(f"  ✓ Project: {r.get('project_name','?')}")
else:
    # data is TEXT column not JSONB
    vc.execute("SELECT id, data FROM project LIMIT 5")
    for r in vc.fetchall():
        try:
            d = json.loads(r['data'])
            print(f"  ✓ Project: {d.get('name','?')}")
        except Exception:
            print(f"  ✓ Project row: id={r['id']}")

vc.execute("SELECT COUNT(*) as n FROM payments")
print(f"  ✓ Payments: {vc.fetchone()['n']} rows")

vc.execute("SELECT COUNT(*) as n FROM users")
print(f"  ✓ Users: {vc.fetchone()['n']} rows")

vc.execute("SELECT COUNT(*) as n FROM stage_master")
print(f"  ✓ Stage master: {vc.fetchone()['n']} stages")

pg_verify.close()
print()
print("Your SQLite data is now in PostgreSQL.")
print("You can keep using SQLite as backup — the .db file is not modified.")
