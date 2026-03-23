from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.entities import Habilidad


DEFAULT_SKILLS_BY_CATEGORY: dict[str, list[str]] = {
    "Creatividad y Artes": [
        "Diseño Gráfico", "UI/UX Design", "Ilustración", "Animación", "Fotografía"
    ],
    "Tecnología y Desarrollo": [
        "Python", "JavaScript", "React", "SQL", "Data Analysis"
    ],
    "Idiomas y Comunicación": [
        "Inglés", "Español", "Oratoria", "Escritura", "Francés"
    ],
    "Negocios y Marketing": [
        "Marketing", "Branding", "Ventas", "SEO", "Narrativa / Storytelling"
    ],
    "Carrera y Habilidades Blandas": [
        "Liderazgo", "Productividad", "Preparación para entrevistas", "Negociación", "Trabajo en equipo"
    ],
    "Estilo de Vida, Juegos y Pasatiempos": [
        "Cocina", "Ejercicio / Fitness", "Guitarra", "Jardinería", "Ajedrez"
    ],
}


def seed_default_habilidades(session: Session) -> None:
    existing = {
        habilidad.nombre.strip().lower(): habilidad
        for habilidad in session.execute(select(Habilidad)).scalars().all()
    }

    changed = False
    for categoria, nombres in DEFAULT_SKILLS_BY_CATEGORY.items():
        for nombre in nombres:
            key = nombre.strip().lower()
            habilidad = existing.get(key)

            if not habilidad:
                session.add(Habilidad(nombre=nombre, categoria=categoria))
                changed = True
                continue

            if habilidad.categoria != categoria:
                habilidad.categoria = categoria
                changed = True

    if changed:
        session.commit()
