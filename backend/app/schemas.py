from pydantic import BaseModel
from typing import Optional, Dict, Any


class ExtractRequest(BaseModel):
    name: str
    type: Optional[str]
    data: Optional[str]


class ExtractResponse(BaseModel):
    success: bool
    fields: Dict[str, Any]
    text: str
    error: Optional[str] = None


class ProjectResponse(BaseModel):
    success: bool
    project: Dict[str, Any]


class StorageResponse(BaseModel):
    success: bool
    key: str
    value: Any


class ProjectResponse(BaseModel):
    success: bool
    project: Dict[str, Any]
