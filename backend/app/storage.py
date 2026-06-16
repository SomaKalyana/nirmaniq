import json
from pathlib import Path
from typing import Any, Dict, Optional

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
STORAGE_FILE = DATA_DIR / 'storage.json'


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_storage() -> Dict[str, Any]:
    if not STORAGE_FILE.exists():
        return {}

    try:
        return json.loads(STORAGE_FILE.read_text(encoding='utf-8')) or {}
    except Exception:
        return {}


def _write_storage(data: Dict[str, Any]) -> None:
    _ensure_data_dir()
    STORAGE_FILE.write_text(json.dumps(data, indent=2), encoding='utf-8')


def save_storage(key: str, value: Any) -> Any:
    data = _read_storage()
    data[key] = value
    _write_storage(data)
    return value


def load_storage(key: str, default: Optional[Any] = None) -> Any:
    data = _read_storage()
    return data.get(key, default)


def save_project(project: Dict[str, Any]) -> Dict[str, Any]:
    return save_storage('project', project)


def load_project() -> Optional[Dict[str, Any]]:
    return load_storage('project', None)
