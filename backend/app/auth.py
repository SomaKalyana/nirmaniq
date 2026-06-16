"""
NirmanIQ — Authentication module
──────────────────────────────────────────────────────────────────────────────
Uses:
  - hashlib SHA-256 + salt  for password hashing (no bcrypt needed)
  - PyJWT 2.x               for session tokens
  - Python secrets           for OTP generation
  - SQLite                   for users and OTP store

OTP delivery:
  In DEV mode (AUTH_DEV_MODE=true in .env), OTP is returned in the API
  response so you can test without SMS/email. Set AUTH_DEV_MODE=false and
  configure SMTP or SMS gateway for production.

JWT secret:
  Set JWT_SECRET in .env. If not set, a random secret is generated on each
  restart (all sessions invalidated on restart — fine for dev).
"""

import hashlib
import hmac
import secrets
import datetime
import os
import sqlite3
import logging
from typing import Optional, Dict, Tuple

import jwt

logger = logging.getLogger("nirmaniq_auth")

# ── Config ─────────────────────────────────────────────────────────────────────

def _jwt_secret() -> str:
    s = os.environ.get("JWT_SECRET", "")
    if not s:
        # Auto-generate and cache so it persists for the process lifetime
        if not hasattr(_jwt_secret, "_cached"):
            _jwt_secret._cached = secrets.token_hex(32)
            logger.warning("JWT_SECRET not set — using random key. Sessions won't survive restart.")
        return _jwt_secret._cached
    return s

DEV_MODE        = os.environ.get("AUTH_DEV_MODE", "true").lower() == "true"
ACCESS_TTL_HRS  = 24        # JWT valid for 24 hours
OTP_TTL_SECS    = 300       # OTP valid for 5 minutes
OTP_LENGTH      = 6


# ── Password hashing (SHA-256 + random salt) ──────────────────────────────────

def _norm(identifier: str) -> str:
    """Normalise email/phone for consistent storage and lookup."""
    s = (identifier or "").strip()
    # If it looks like an email, lowercase it; phones stay as-is
    return s.lower() if "@" in s else s


def hash_password(plain: str) -> str:
    """Return 'salt$hash' string."""
    salt = secrets.token_hex(16)
    h    = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 200_000)
    return f"{salt}${h.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    """Verify plain password against stored 'salt$hash'."""
    if "$" not in stored:
        return False
    salt, stored_hash = stored.split("$", 1)
    h = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 200_000)
    return hmac.compare_digest(h.hex(), stored_hash)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str, name: str) -> str:
    payload = {
        "sub":   user_id,
        "email": email,
        "name":  name,
        "iat":   datetime.datetime.now(datetime.timezone.utc),
        "exp":   datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=ACCESS_TTL_HRS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ── OTP generation ────────────────────────────────────────────────────────────

def generate_otp() -> str:
    return "".join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])


def send_otp(identifier: str, otp: str, channel: str) -> Dict:
    """
    In dev mode: return OTP in response (for testing).
    In production: integrate SMTP / SMS gateway here.
    """
    if DEV_MODE:
        logger.info(f"[DEV] OTP for {identifier}: {otp}")
        return {"devOtp": otp, "message": f"[DEV MODE] OTP: {otp} — In production this would be sent via {channel}"}

    if channel == "email":
        # TODO: integrate SMTP
        logger.warning(f"SMTP not configured — OTP not sent to {identifier}")
        return {"message": "OTP sent to email"}

    if channel == "sms":
        # TODO: integrate SMS gateway (e.g. MSG91, Twilio)
        logger.warning(f"SMS gateway not configured — OTP not sent to {identifier}")
        return {"message": "OTP sent to SMS"}

    return {"message": "OTP sent"}


# ── SQLite user + OTP tables ───────────────────────────────────────────────────

from .database import get_conn, DATA_DIR
from pathlib import Path


USERS_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE,
    phone           TEXT UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT DEFAULT 'owner',      -- owner | builder | viewer
    is_verified     INTEGER DEFAULT 0,
    mfa_enabled     INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now')),
    last_login_at   TEXT DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone != '';

CREATE TABLE IF NOT EXISTS otp_store (
    id              TEXT PRIMARY KEY,
    identifier      TEXT NOT NULL,   -- email or phone
    otp_hash        TEXT NOT NULL,   -- hashed OTP
    purpose         TEXT NOT NULL,   -- 'login' | 'register' | 'reset'
    attempts        INTEGER DEFAULT 0,
    expires_at      TEXT NOT NULL,
    used            INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    token_hash      TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    expires_at      TEXT NOT NULL,
    revoked         INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""


def init_auth_tables() -> None:
    conn = get_conn()
    try:
        conn.executescript(USERS_SCHEMA)
        conn.commit()
    finally:
        conn.close()


# ── User CRUD ─────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def find_user_by_identifier(identifier: str) -> Optional[Dict]:
    """Find user by email or phone (normalised)."""
    ident = identifier.strip().lower()
    conn  = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE LOWER(email)=? OR phone=?", (ident, identifier.strip())
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def find_user_by_id(user_id: str) -> Optional[Dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_user(user_id: str, name: str, email: str, phone: str,
                password_hash: str, role: str = "owner") -> Dict:
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?,?,?,?,?,?)",
            (user_id, name, email.strip().lower() if email else "",
             phone.strip() if phone else "", password_hash, role)
        )
        conn.commit()
        return find_user_by_id(user_id)
    finally:
        conn.close()


def update_last_login(user_id: str) -> None:
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET last_login_at=? WHERE id=?", (_now_iso(), user_id))
        conn.commit()
    finally:
        conn.close()


def verify_user_account(user_id: str) -> None:
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET is_verified=1 WHERE id=?", (user_id,))
        conn.commit()
    finally:
        conn.close()


# ── OTP CRUD ──────────────────────────────────────────────────────────────────

def store_otp(identifier: str, otp: str, purpose: str) -> str:
    """Hash and store OTP. Returns otp_id for verification."""
    import uuid
    identifier = _norm(identifier)  # normalise before storage
    otp_id   = str(uuid.uuid4())
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()
    expires  = (datetime.datetime.now(datetime.timezone.utc)
                + datetime.timedelta(seconds=OTP_TTL_SECS)).isoformat()
    conn = get_conn()
    try:
        # Invalidate old OTPs for same identifier + purpose
        conn.execute(
            "UPDATE otp_store SET used=1 WHERE identifier=? AND purpose=? AND used=0",
            (identifier, purpose)
        )
        conn.execute(
            "INSERT INTO otp_store (id, identifier, otp_hash, purpose, expires_at) VALUES (?,?,?,?,?)",
            (otp_id, identifier, otp_hash, purpose, expires)
        )
        conn.commit()
    finally:
        conn.close()
    return otp_id


def verify_otp(identifier: str, otp: str, purpose: str) -> Tuple[bool, str]:
    """
    Returns (success, reason).
    reason: 'ok' | 'expired' | 'wrong' | 'too_many_attempts' | 'not_found'
    """
    identifier = _norm(identifier)  # normalise before lookup
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM otp_store WHERE identifier=? AND purpose=? AND used=0 "
            "ORDER BY created_at DESC LIMIT 1",
            (identifier, purpose)
        ).fetchone()

        if not row:
            return False, "not_found"

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if now > row["expires_at"]:
            return False, "expired"

        if row["attempts"] >= 5:
            return False, "too_many_attempts"

        otp_hash = hashlib.sha256(otp.encode()).hexdigest()
        if not hmac.compare_digest(otp_hash, row["otp_hash"]):
            conn.execute(
                "UPDATE otp_store SET attempts=attempts+1 WHERE id=?", (row["id"],)
            )
            conn.commit()
            return False, "wrong"

        # Mark used
        conn.execute("UPDATE otp_store SET used=1 WHERE id=?", (row["id"],))
        conn.commit()
        return True, "ok"
    finally:
        conn.close()
