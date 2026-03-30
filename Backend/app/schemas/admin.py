from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class StatsResponse(BaseModel):
    total_users: int
    total_exchanges: int
    average_rating: float
    total_skills: int


class UserListItem(BaseModel):
    id: int
    username: str
    email: str
    role: str
    fecha_registro: Optional[str]
    ultimo_login: Optional[str]


class PaginationMeta(BaseModel):
    total_users: int
    total_pages: int
    current_page: int
    limit: int


class UserListResponse(BaseModel):
    users: List[UserListItem]
    pagination: PaginationMeta


class UserStats(BaseModel):
    exchanges_sent: int
    exchanges_received: int
    exchanges_completed: int
    reviews_count: int
    average_rating: float


class SkillItem(BaseModel):
    id: int
    nombre: str
    categoria: str


class UserSkills(BaseModel):
    offered: List[SkillItem]
    wanted: List[SkillItem]


class UserDetailResponse(BaseModel):
    user: dict
    stats: UserStats
    skills: UserSkills


class RoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(user|admin|superadmin)$")


class SkillWithStats(BaseModel):
    id: int
    nombre: str
    categoria: str
    users_offering: int
    users_seeking: int


class SkillListResponse(BaseModel):
    skills: List[SkillWithStats]


class DailyActivity(BaseModel):
    date: str
    new_users: int
    exchanges: int


class ActivityReportResponse(BaseModel):
    period: dict
    summary: dict
    daily_data: List[DailyActivity]


class SkillCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=20, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$")
    categoria: str = Field(..., min_length=1, max_length=30, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$")


class CategoriesResponse(BaseModel):
    categories: List[str]
