import re
import unicodedata
from typing import Optional

from app.core.config import settings


try:
    from better_profanity import profanity

    profanity.load_censor_words()
    _PROFANITY_READY = True
except Exception:
    profanity = None
    _PROFANITY_READY = False


_HATE_TERMS = {
    "odio",
    "racista",
    "nazi",
    "matar",
    "muerte",
    "xenofobo",
    "maricon",
    "marica",
    "traba",
    "tortillera",
    "comepijas",
    "tragaleche",
    "sodomita",
    "maraco",
    "faggot",
    "fag",
    "dyke",
    "dyae",
    "tranny",
    "queer",
    "homo",
    "pansy",
    "negro de mierda",
    "mierda",
    "sudaca",
    "veneco",
    "tiraflechas",
    "indio",
    "saltamuros",
    "gachupin",
    "nigger",
    "nigga",
    "spic",
    "wetback",
    "chink",
    "raghead",
    "gook",
    "coon",
    "retrasado",
    "mogolico",
    "down",
    "subnormal",
    "invalido",
    "deficiente",
    "mongolo",
    "vegetal",
    "retard",
    "tard",
    "spastic",
    "spaz",
    "special ed",
    "moron",
    "judio de mierda",
    "perro infiel",
    "comecuras",
    "fanatico",
    "kike",
    "bible thumper",
    "infidel",
}

_ADULT_TERMS = {
    "sexo",
    "sexual",
    "porno",
    "porn",
    "xxx",
    "nudes",
    "desnudo",
    "cuca",
    "vagina",
    "pene",
    "culo",
    "culos",
}

_TOXIC_TERMS = {
    "idiota",
    "imbecil",
    "estupido",
    "inutil",
    "asqueroso",
    "basura",
    "mierda",
    "hijo de puta",
    "malparido",
    "gonorrea",
    "concha de tu madre",
    "culiao",
    "pendejo",
    "mamaguevo",
    "cabron",
    "pinche",
    "motherfucker",
    "bitch",
    "asshole",
    "cunt",
    "slut",
    "whore",
}

_CRIMINAL_TERMS = {
    "violador",
    "violacion",
    "violin",
    "pedofilo",
    "pedofilia",
    "pederasta",
    "rapist",
    "rape",
    "raping",
    "raped",
    "pedo",
    "paedo",
    "pedophile",
    "pedophilia",
    "groomer",
    "grooming",
    "acosador de menores",
    "zoofilia",
    "zoofilico",
    "bestiality",
    "animal molester",
    "necrofilia",
    "necrofilico",
    "necrophilia",
    "incesto",
    "incest",
    "incestuoso",
    "depredador sexual",
    "sexual predator",
    "predatory",
    "abusador",
    "abuser",
    "sexual abuser",
    "molestador",
    "molester",
    "child molester",
}

_SENSITIVE_ENTITY_TERMS = {
    "diddy",
    "epstein",
}

_NEUTRAL_STANDALONE_TERMS = {
    "negros",
    "negras",
}

_KEYBOARD_SPAM_PARTS = (
    "qwerty",
    "asdf",
    "zxcv",
    "qazwsx",
    "poiuy",
    "lkjhg",
    "kjhg",
)

_LEET_MAP = str.maketrans(
    {
        "0": "o",
        "1": "i",
        "2": "z",
        "3": "e",
        "4": "a",
        "5": "s",
        "6": "g",
        "7": "t",
        "8": "b",
        "9": "g",
        "@": "a",
        "$": "s",
        "!": "i",
    }
)


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _normalize(value: Optional[str]) -> str:
    lowered = (value or "").strip().lower()
    lowered = _strip_accents(lowered)
    lowered = lowered.translate(_LEET_MAP)
    lowered = re.sub(r"\s+", " ", lowered)
    return lowered


def _compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value)


def _tokenize(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_]+", value))


def _extra_terms() -> set[str]:
    raw = settings.TEXT_MODERATION_EXTRA_BLOCKED_TERMS or ""
    if not raw.strip():
        return set()
    return {_normalize(term) for term in raw.split(",") if term.strip()}


def _moderation_level() -> str:
    level = (settings.TEXT_MODERATION_LEVEL or "medium").strip().lower()
    return level if level in {"strict", "medium", "relaxed"} else "medium"


def _contains_profanity(text: str) -> bool:
    if not text:
        return False
    if not settings.TEXT_MODERATION_ENABLE_PROFANITY:
        return False
    if _PROFANITY_READY and profanity is not None:
        try:
            return profanity.contains_profanity(text)
        except Exception:
            return False
    return False


def _is_neutral_standalone_term(text: str) -> bool:
    return text.strip() in _NEUTRAL_STANDALONE_TERMS


def _contains_any_terms(text: str, terms: set[str]) -> bool:
    if not text:
        return False
    words = _tokenize(text)
    compact_text = _compact(text)
    if not words.isdisjoint(terms):
        return True
    return any(_compact(term) in compact_text for term in terms if term)


def _is_spam_like(text: str) -> bool:
    if not text:
        return False

    level = _moderation_level()
    repeat_char_threshold = 4 if level == "strict" else 5 if level == "medium" else 6
    repeat_block_threshold = 2 if level == "strict" else 3 if level == "medium" else 4
    low_unique_token_ratio = 0.45 if level == "strict" else 0.35 if level == "medium" else 0.25
    low_unique_char_ratio = 0.28 if level == "strict" else 0.22 if level == "medium" else 0.18
    low_vowel_ratio = 0.35 if level == "strict" else 0.30 if level == "medium" else 0.24

    compact = re.sub(r"\s+", "", text.lower())
    if len(compact) < 8:
        return False

    if re.search(rf"(.)\1{{{repeat_char_threshold},}}", compact):
        return True

    if re.search(rf"(.{{2,4}})\1{{{repeat_block_threshold},}}", compact):
        return True

    if any(part in compact for part in _KEYBOARD_SPAM_PARTS):
        return True

    tokens = [tok for tok in re.split(r"\s+", text.lower()) if tok]

    # Detect likely gibberish: very long token with too few vowels.
    if tokens:
        vowels = set("aeiou")
        for token in tokens:
            alnum_token = re.sub(r"[^a-z0-9]", "", token)
            if len(alnum_token) >= 12:
                vowel_count = sum(1 for ch in alnum_token if ch in vowels)
                if vowel_count / max(len(alnum_token), 1) <= low_vowel_ratio:
                    return True

    if len(tokens) >= 4:
        unique_ratio = len(set(tokens)) / len(tokens)
        if unique_ratio <= low_unique_token_ratio:
            return True

    if len(compact) >= 12:
        unique_chars = len(set(compact))
        if unique_chars / len(compact) <= low_unique_char_ratio:
            return True

    return False


def get_text_policy_error(text: Optional[str]) -> Optional[str]:
    raw_text = (text or "").strip().lower()
    if re.search(r"\bcoño(s)?\b", raw_text):
        return "contiene comentarios toxicos"

    normalized = _normalize(text)
    if not normalized:
        return None

    # Allow neutral color words when submitted without extra context.
    if _is_neutral_standalone_term(normalized):
        return None

    level = _moderation_level()

    if _contains_profanity(normalized):
        return "contiene lenguaje ofensivo"

    dynamic_block_terms = _extra_terms()
    if dynamic_block_terms and _contains_any_terms(normalized, dynamic_block_terms):
        return "contiene lenguaje bloqueado por politica"

    if _contains_any_terms(normalized, _HATE_TERMS):
        return "contiene discurso de odio o violencia"

    if _contains_any_terms(normalized, _CRIMINAL_TERMS):
        return "contiene lenguaje criminal o abuso sexual"

    if _contains_any_terms(normalized, _ADULT_TERMS):
        return "contiene contenido para adultos (+18)"

    if _contains_any_terms(normalized, _SENSITIVE_ENTITY_TERMS):
        return "contiene lenguaje bloqueado por politica"

    if level in {"strict", "medium"} and _contains_any_terms(normalized, _TOXIC_TERMS):
        return "contiene comentarios toxicos"

    if _is_spam_like(normalized):
        return "parece spam o texto sin sentido"

    return None


def assert_text_is_allowed(field_name: str, text: Optional[str]) -> None:
    reason = get_text_policy_error(text)
    if not reason:
        return
    raise ValueError(f"{field_name}: {reason}")


# Alias for convenience
def moderate_text(text: Optional[str]) -> Optional[str]:
    """
    Alias for get_text_policy_error.
    Returns error message if text violates policy, None otherwise.
    """
    return get_text_policy_error(text)
