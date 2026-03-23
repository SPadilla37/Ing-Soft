from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.entities import Habilidad


DEFAULT_SKILLS_BY_CATEGORY: dict[str, list[str]] = {
    "Creative & Arts": ["Graphic Design", "UI/UX Design", "Illustration", "Animation", "Photography"],
    "Tech & Development": ["Python", "JavaScript", "React", "SQL", "Data Analysis"],
    "Language & Communication": ["English", "Spanish", "Public Speaking", "Writing", "French"],
    "Business & Marketing": ["Marketing", "Branding", "Sales", "SEO", "Storytelling"],
    "Career & Soft Skills": ["Leadership", "Productivity", "Interview Prep", "Negotiation", "Teamwork"],
    "Lifestyle, Games & Hobbies": ["Cooking", "Fitness", "Guitar", "Gardening", "Chess"],
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
