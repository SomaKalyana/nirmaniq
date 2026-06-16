# NirmanIQ — Construction Project Tracker

Track your residential construction project stage-by-stage. Built for investors and plot owners in Visakhapatnam and the broader AP / Telangana market.

---

## Folder structure

```
nirmaniq/
├── frontend/                  ← React + Vite (UI)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        TopBar, Nav
│   │   │   └── ui/            Shared UI primitives
│   │   ├── data/              Stage, material, budget, prereq data
│   │   ├── hooks/             useAppData (central state)
│   │   ├── pages/             Dashboard, Stages, Landing, Login, etc.
│   │   ├── styles/            global.css (design tokens)
│   │   └── utils/             colors, format, api, estimator
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                   ← Python FastAPI (plan extraction service)
│   ├── app/
│   │   ├── main.py            FastAPI app + CORS
│   │   ├── api.py             Route handlers
│   │   ├── extractor.py       PDF/image text extraction (PyMuPDF + Tesseract)
│   │   ├── parse_fields.py    Regex field parser
│   │   ├── storage.py         JSON file persistence
│   │   ├── schemas.py         Pydantic models
│   │   └── utils.py           Text normalisation
│   ├── data/
│   │   └── storage.json       Persisted project + app data
│   ├── tests/
│   │   └── test_parse_fields.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml         ← Run both services together
├── .env.example               ← Copy to .env, add ANTHROPIC_API_KEY
└── README.md
```

---

## Quick start

### Option A — Docker (recommended)

```bash
# 1. Copy env file and add your API key
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY=sk-ant-...

# 2. Start both services
docker-compose up

# 3. Open browser
# Frontend → http://localhost:5173
# Backend  → http://localhost:5174
```

### Option B — Run separately

**Backend:**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5174 --reload
```

**Frontend (new terminal):**

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Features

| Module            | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| Landing page      | Full marketing page with slideshow, flow diagram, bank loan section |
| Authentication    | Register / login flow with project selection                        |
| Project hierarchy | Tree view — owner → projects → create new inline                    |
| Pre-construction  | 52-item GVMC/APDPMS/bank checklist                                  |
| Stage tracker     | 15 stages, 100+ tasks from IS codes                                 |
| Material tracker  | Quantities from plot dimensions, order/receive tracking             |
| Budget & payments | 10 categories, per-payment logging                                  |
| Site log & photos | Daily diary with stage-tagging                                      |
| TopBar            | User avatar, notification bell, context-aware help                  |

---

## Environment variables

| Variable            | Required             | Description                                 |
| ------------------- | -------------------- | ------------------------------------------- |
| `ANTHROPIC_API_KEY` | Yes (for extraction) | Claude API key for plan document extraction |

---

## Design

- **Fonts:** Inter (body), Outfit (headings), JetBrains Mono (data)
- **Palette:** Deep navy (`#0D1117`) + warm amber-gold (`#E6A817`) accent
- **Responsive:** Mobile bottom nav, desktop sidebar nav
