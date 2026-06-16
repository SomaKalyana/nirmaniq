from dotenv import load_dotenv
import os
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../..', '.env'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import router
from .database import init_db, seed_stage_master, seed_config_master
from .auth import init_auth_tables
from .stages_seed import STAGES_SEED
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")

app = FastAPI(title="NirmanIQ Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    init_db()
    init_auth_tables()
    seed_stage_master(STAGES_SEED)
    seed_config_master()
    # Note: if you update stages_seed.py, call POST /api/stages/master/reset-and-reseed
    # to reload stages into the database without losing project tracking data.

app.include_router(router, prefix="/api")

@app.get("/api/health")
async def health():
    import os
    db_type = "postgresql" if os.environ.get("DATABASE_URL","") else "sqlite"
    return {"status": "ok", "db": db_type}

@app.get("/health")
async def health_root():
    return {"status": "ok"}
