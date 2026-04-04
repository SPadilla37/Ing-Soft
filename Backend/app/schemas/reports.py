"""
Pydantic schemas for user reports system.

Defines request/response models for report creation, management, and statistics.
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, validator, Field
from typing_extensions import Literal


class ReportCreateRequest(BaseModel):
    """Schema for creating a new report."""
    
    reportado_id: int = Field(..., description="ID of the user being reported")
    motivo: str = Field(..., description="Reason for the report")
    descripcion: Optional[str] = Field(None, description="Optional detailed description (max 500 chars)")
    
    @validator('motivo')
    def validate_motivo(cls, v):
        """Validate that motivo is one of the predefined reasons."""
        valid_reasons = [
            "Comportamiento inapropiado",
            "Información falsa en perfil",
            "No cumplió con el intercambio",
            "Spam o contenido no deseado",
            "Suplantación de identidad",
            "Otro motivo"
        ]
        if v not in valid_reasons:
            raise ValueError(f'Motivo inválido. Debe ser uno de: {", ".join(valid_reasons)}')
        return v
    
    @validator('descripcion')
    def validate_descripcion(cls, v):
        """Validate that descripcion doesn't exceed 500 characters."""
        if v and len(v) > 500:
            raise ValueError('Descripción no puede exceder 500 caracteres')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "reportado_id": 123,
                "motivo": "Comportamiento inapropiado",
                "descripcion": "El usuario fue muy grosero durante la conversación"
            }
        }


class ReportResponse(BaseModel):
    """Schema for report response (user-facing, no reporter info)."""
    
    id: int
    reportado_username: str
    motivo: str
    descripcion: Optional[str]
    estado: str
    fecha_creacion: str
    fecha_resolucion: Optional[str]
    accion_tomada: Optional[str]
    
    class Config:
        from_attributes = True


class ReportDetailResponse(BaseModel):
    """Schema for detailed report response (admin-facing, includes reporter info)."""
    
    id: int
    reportante: Optional[dict] = None  # Only for admins
    reportado: Optional[dict] = None
    reportado_username: str
    motivo: str
    descripcion: Optional[str]
    estado: str
    fecha_creacion: str
    fecha_resolucion: Optional[str]
    accion_tomada: Optional[str]
    resuelto_por: Optional[dict] = None
    notas_admin: Optional[str] = None
    
    class Config:
        from_attributes = True


class ReportStatusUpdateRequest(BaseModel):
    """Schema for updating report status."""
    
    status: Literal['pendiente', 'en_revision', 'descartado'] = Field(
        ..., 
        description="New status for the report"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "en_revision"
            }
        }


class ReportResolveRequest(BaseModel):
    """Schema for resolving a report with an action."""
    
    action: Literal['ninguna', 'advertencia', 'suspension', 'eliminacion'] = Field(
        ...,
        description="Action to take on the reported user"
    )
    notas_admin: Optional[str] = Field(None, description="Optional admin notes")
    
    @validator('notas_admin')
    def validate_notas_admin(cls, v):
        """Validate that notas_admin doesn't exceed reasonable length."""
        if v and len(v) > 1000:
            raise ValueError('Notas administrativas no pueden exceder 1000 caracteres')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "action": "suspension",
                "notas_admin": "Usuario violó términos de servicio múltiples veces"
            }
        }


class ReportStatsResponse(BaseModel):
    """Schema for report statistics."""
    
    pending_count: int = Field(..., description="Number of pending reports")
    resolved_count: int = Field(..., description="Number of resolved reports")
    total_count: int = Field(..., description="Total number of reports")
    
    class Config:
        json_schema_extra = {
            "example": {
                "pending_count": 5,
                "resolved_count": 12,
                "total_count": 17
            }
        }


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    total: int = Field(..., description="Total number of items")
    pages: int = Field(..., description="Total number of pages")


class ReportListResponse(BaseModel):
    """Schema for paginated list of reports."""
    
    reports: List[ReportResponse]
    pagination: PaginationMeta
    
    class Config:
        json_schema_extra = {
            "example": {
                "reports": [
                    {
                        "id": 1,
                        "reportado_username": "user123",
                        "motivo": "Comportamiento inapropiado",
                        "descripcion": "Fue muy grosero",
                        "estado": "pendiente",
                        "fecha_creacion": "2024-01-15T10:30:00",
                        "fecha_resolucion": None,
                        "accion_tomada": None
                    }
                ],
                "pagination": {
                    "page": 1,
                    "limit": 10,
                    "total": 25,
                    "pages": 3
                }
            }
        }
