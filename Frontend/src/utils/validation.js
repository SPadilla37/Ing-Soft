/**
 * Limites alineados con el backend (Pydantic / esquemas).
 */
export const LIMITS = {
  emailMax: 120,
  usernameMin: 3,
  usernameMax: 25,
  passwordMin: 6,
  passwordMax: 200,
  nombreMax: 35,
  bioMax: 2000,
  chatMessageMax: 2000,
  messageRequestMax: 500,
  searchMax: 200,
};

export function validateEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  if (!raw) return { ok: false, message: "El correo es obligatorio." };
  if (raw.length > LIMITS.emailMax) {
    return { ok: false, message: `El correo no puede superar ${LIMITS.emailMax} caracteres.` };
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(raw)) return { ok: false, message: "Introduce un correo valido (ejemplo: nombre@dominio.com)." };
  return { ok: true, value: raw };
}

export function validatePassword(pass) {
  const p = String(pass || "");
  if (p.length < LIMITS.passwordMin) {
    return { ok: false, message: `La contrasena debe tener al menos ${LIMITS.passwordMin} caracteres.` };
  }
  if (p.length > LIMITS.passwordMax) {
    return { ok: false, message: `La contrasena no puede superar ${LIMITS.passwordMax} caracteres.` };
  }
  return { ok: true, value: p };
}

export function validateUsername(u) {
  const s = String(u || "").trim();
  if (s.length < LIMITS.usernameMin) {
    return { ok: false, message: `El nombre de usuario debe tener al menos ${LIMITS.usernameMin} caracteres.` };
  }
  if (s.length > LIMITS.usernameMax) {
    return { ok: false, message: `El nombre de usuario no puede superar ${LIMITS.usernameMax} caracteres.` };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(s)) {
    return { ok: false, message: "El usuario solo puede usar letras, numeros y los simbolos . _ -" };
  }
  return { ok: true, value: s };
}

export function validateRequiredTrimmed(text, fieldLabel, maxLen) {
  const t = String(text || "").trim();
  if (!t) return { ok: false, message: `${fieldLabel} es obligatorio.` };
  if (maxLen != null && t.length > maxLen) {
    return { ok: false, message: `${fieldLabel} no puede superar ${maxLen} caracteres.` };
  }
  return { ok: true, value: t };
}

export function validateOptionalTrimmed(text, maxLen, fieldLabel) {
  const t = String(text || "").trim();
  if (maxLen != null && t.length > maxLen) {
    return { ok: false, message: `${fieldLabel} no puede superar ${maxLen} caracteres.` };
  }
  return { ok: true, value: t };
}

export function validateChatMessage(content) {
  const t = String(content || "").trim();
  if (!t) return { ok: false, message: "Escribe un mensaje antes de enviar." };
  if (t.length > LIMITS.chatMessageMax) {
    return { ok: false, message: `El mensaje no puede superar ${LIMITS.chatMessageMax} caracteres.` };
  }
  return { ok: true, value: t };
}

export function validatePublishMessage(text) {
  return validateOptionalTrimmed(text, LIMITS.messageRequestMax, "El mensaje de la publicacion");
}

export function validateSearchQuery(text) {
  const t = String(text || "").trim();
  if (t.length > LIMITS.searchMax) {
    return { ok: false, message: `La busqueda no puede superar ${LIMITS.searchMax} caracteres.` };
  }
  return { ok: true, value: t };
}

export function validateConversationIdInput(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: false, message: "Selecciona una conversacion o escribe un ID valido." };
  if (!/^\d+$/.test(s)) return { ok: false, message: "El ID de conversacion debe ser un numero entero." };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) return { ok: false, message: "El ID de conversacion no es valido." };
  return { ok: true, value: s };
}

/**
 * Nombre visible en perfil: se parte en nombre (1ª palabra) y apellidos (resto), max 35 cada uno (BD).
 */
export function validateProfileFullName(text) {
  const t = String(text || "").trim();
  if (!t) return { ok: false, message: "El nombre es obligatorio." };
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const rest = parts.slice(1).join(" ");
  if (first.length > LIMITS.nombreMax) {
    return { ok: false, message: `El nombre no puede superar ${LIMITS.nombreMax} caracteres.` };
  }
  if (rest.length > LIMITS.nombreMax) {
    return { ok: false, message: `Los apellidos no pueden superar ${LIMITS.nombreMax} caracteres en total.` };
  }
  return { ok: true, value: t };
}

/** Valoracion 0-5 (backend suele aceptar entero en ese rango). */
export function validateRatingValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 5) {
    return { ok: false, message: "La calificacion debe ser un entero entre 0 y 5." };
  }
  return { ok: true, value: n };
}
