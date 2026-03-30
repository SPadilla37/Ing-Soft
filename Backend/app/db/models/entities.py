from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(25), nullable=False)
    email = Column(String(50), nullable=False)
    password_hash = Column(String(100), nullable=False)
    clerk_id = Column(String(35), nullable=False)
    nombre = Column(String(35), nullable=False)
    apellido = Column(String(35), nullable=False)
    foto_url = Column(String(50), nullable=True)
    biografia = Column(Text, nullable=True)
    ultimo_login = Column(TIMESTAMP, nullable=True)
    fecha_registro = Column(TIMESTAMP, nullable=True)
    role = Column(String(10), nullable=False, default='user', server_default='user', index=True)

    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin', 'superadmin')", name="usuarios_role_check"),
    )

    habilidades_ofertadas = relationship("UsuarioHabilidad", foreign_keys="UsuarioHabilidad.usuario_id", back_populates="usuario")
    intercambios_enviados = relationship("Intercambio", foreign_keys="Intercambio.usuario_emisor_id", back_populates="emisor")
    intercambios_recibidos = relationship("Intercambio", foreign_keys="Intercambio.usuario_receptor_id", back_populates="receptor")
    reseñas_autor = relationship("Reseña", foreign_keys="Reseña.autor_id", back_populates="autor")
    reseñas_receptor = relationship("Reseña", foreign_keys="Reseña.receptor_id", back_populates="receptor")
    mensajes = relationship("Mensaje", back_populates="remitente")
    conversaciones_iniciadas = relationship("Conversacion", foreign_keys="Conversacion.usuario_1_id", back_populates="usuario1")
    conversaciones_recibidas = relationship("Conversacion", foreign_keys="Conversacion.usuario_2_id", back_populates="usuario2")


class Habilidad(Base):
    __tablename__ = "habilidades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), nullable=False, unique=True)
    categoria = Column(String(30), nullable=False)

    usuarios = relationship("UsuarioHabilidad", back_populates="habilidad")


class Intercambio(Base):
    __tablename__ = "intercambios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_emisor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    usuario_receptor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    habilidad_id = Column(Integer, ForeignKey("habilidades.id"), nullable=True)
    habilidad_solicitada_id = Column(Integer, ForeignKey("habilidades.id"), nullable=True)
    mensaje = Column(Text, nullable=True)
    estado = Column(String(12), nullable=False)
    fecha_creacion = Column(TIMESTAMP, nullable=False)

    __table_args__ = (
        CheckConstraint("estado IN ('pendiente', 'aceptado', 'completado', 'cancelado')", name="intercambios_estado_check"),
    )

    emisor = relationship("Usuario", foreign_keys=[usuario_emisor_id], back_populates="intercambios_enviados")
    receptor = relationship("Usuario", foreign_keys=[usuario_receptor_id], back_populates="intercambios_recibidos")
    habilidad = relationship("Habilidad", foreign_keys=[habilidad_id])
    habilidad_solicitada = relationship("Habilidad", foreign_keys=[habilidad_solicitada_id])
    reseñas = relationship("Reseña", back_populates="intercambio")


class IntercambioFinalizacion(Base):
    __tablename__ = "intercambios_finalizaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intercambio_id = Column(Integer, ForeignKey("intercambios.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False)

    __table_args__ = (
        UniqueConstraint("intercambio_id", "usuario_id", name="uq_intercambio_finalizacion_usuario"),
    )


class Mensaje(Base):
    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    remitente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    conversacion_id = Column(Integer, ForeignKey("conversaciones.id"), nullable=False)
    contenido = Column(Text, nullable=False)
    enviado_at = Column(TIMESTAMP, nullable=True)

    remitente = relationship("Usuario", back_populates="mensajes")
    conversacion = relationship("Conversacion", back_populates="mensajes")


class Reseña(Base):
    __tablename__ = "reseñas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intercambio_id = Column(Integer, ForeignKey("intercambios.id"), nullable=True)
    autor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    receptor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    calificacion = Column(Integer, nullable=False)
    comentario = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, nullable=True)

    intercambio = relationship("Intercambio", back_populates="reseñas")
    autor = relationship("Usuario", foreign_keys=[autor_id], back_populates="reseñas_autor")
    receptor = relationship("Usuario", foreign_keys=[receptor_id], back_populates="reseñas_receptor")


class UsuarioHabilidad(Base):
    __tablename__ = "usuarios_habilidades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    habilidad_id = Column(Integer, ForeignKey("habilidades.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    categoria = Column(String(8), nullable=False)

    __table_args__ = (
        CheckConstraint("categoria IN ('ofertada', 'buscada')", name="usuarios_habilidades_categoria_check"),
    )

    habilidad = relationship("Habilidad", back_populates="usuarios")
    usuario = relationship("Usuario", back_populates="habilidades_ofertadas")


class Conversacion(Base):
    __tablename__ = "conversaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_1_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    usuario_2_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    usuario1 = relationship("Usuario", foreign_keys=[usuario_1_id], back_populates="conversaciones_iniciadas")
    usuario2 = relationship("Usuario", foreign_keys=[usuario_2_id], back_populates="conversaciones_recibidas")
    mensajes = relationship("Mensaje", back_populates="conversacion")