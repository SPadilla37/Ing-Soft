const USERNAME_REGEX = /^[a-zA-Z0-9._]+$/;
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/;
const BIO_REGEX = /^[\w\sáéíóúÁÉÍÓÚñÑ+*=/%^.,!?:;()"'\\/-]*$/;

const HATE_TERMS = ["odio", "racista", "nazi", "matar", "muerte", "xenofobo"];
const ADULT_TERMS = ["sexo", "sexual", "porn", "porno", "xxx", "nudes", "desnudo", "cuca", "vagina", "pene", "culo", "culos"];
const TOXIC_TERMS = ["idiota", "imbecil", "estupido", "inutil", "asqueroso", "basura"];
const SENSITIVE_ENTITY_TERMS = ["diddy", "epstein"];
const KEYBOARD_SPAM_PARTS = ["qwerty", "asdf", "zxcv", "qazwsx", "poiuy", "lkjhg", "kjhg"];

const normalize = (value) => (value || "").trim().toLowerCase();

const containsAny = (text, words) => words.some((word) => text.includes(word));

const isSpamLike = (text) => {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 8) return false;
  if (/(.)\1{5,}/.test(compact)) return true;
  if (/(.{2,4})\1{3,}/.test(compact)) return true;
  if (KEYBOARD_SPAM_PARTS.some((part) => compact.includes(part))) return true;

  const tokens = text.split(/\s+/).filter(Boolean);
  const vowels = new Set(["a", "e", "i", "o", "u"]);

  for (const token of tokens) {
    const alnum = token.replace(/[^a-z0-9]/g, "");
    if (alnum.length >= 12) {
      const vowelCount = [...alnum].filter((ch) => vowels.has(ch)).length;
      if ((vowelCount / Math.max(alnum.length, 1)) <= 0.30) return true;
    }
  }

  if (tokens.length >= 4) {
    const uniqueRatio = new Set(tokens).size / tokens.length;
    if (uniqueRatio <= 0.35) return true;
  }

  if (compact.length >= 12) {
    const uniqueCharRatio = new Set(compact).size / compact.length;
    if (uniqueCharRatio <= 0.22) return true;
  }

  return false;
};

const moderationError = (value) => {
  const text = normalize(value);
  if (!text) return "";
  if (containsAny(text, HATE_TERMS)) return "Contiene discurso de odio o violencia";
  if (containsAny(text, ADULT_TERMS)) return "Contiene contenido para adultos (+18)";
  if (containsAny(text, SENSITIVE_ENTITY_TERMS)) return "Contiene lenguaje bloqueado por politica";
  if (containsAny(text, TOXIC_TERMS)) return "Contiene comentarios toxicos";
  if (isSpamLike(text)) return "Parece spam o texto sin sentido";
  return "";
};

export const parseModerationErrorMessage = (message) => {
  if (!message || typeof message !== "string") return null;
  const match = message.match(/^([a-z_]+):\s*(.+)$/i);
  if (!match) return null;
  return { field: match[1].toLowerCase(), reason: match[2] };
};

export const validateUsernameText = (username) => {
  const value = username || "";
  if (!value.trim()) return "El nombre de usuario es requerido";
  if (/^[\d]+$/.test(value)) return "El nombre de usuario no puede ser solo numeros";
  if (/^[^\w]+$/.test(value)) return "El nombre de usuario no puede tener solo caracteres especiales";
  if (!USERNAME_REGEX.test(value)) return "Solo letras, numeros, puntos (.) y guiones bajos (_)";
  if (/\s/.test(value)) return "No se permiten espacios";
  return moderationError(value);
};

export const validateNameText = (value, maxLength = 25) => {
  if ((value || "").length > maxLength) return `Maximo ${maxLength} caracteres`;
  if (!NAME_REGEX.test(value || "")) return "Solo se permiten letras y espacios";
  return moderationError(value);
};

export const sanitizeNameInput = (value, maxLength = 25) => {
  const sliced = (value || "").slice(0, maxLength);
  return sliced
    .split("")
    .filter((char) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]$/.test(char))
    .join("");
};

export const validateBioText = (value, maxLength = 500) => {
  const bio = value || "";
  if (bio.length > maxLength) return `Maximo ${maxLength} caracteres`;
  if (!BIO_REGEX.test(bio)) return "Caracteres no permitidos";
  return moderationError(bio);
};

export const validateReviewCommentText = (value, maxLength = 500) => {
  const comment = value || "";
  if (comment.length > maxLength) return `Maximo ${maxLength} caracteres`;
  return moderationError(comment);
};
