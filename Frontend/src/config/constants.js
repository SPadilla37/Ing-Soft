const rawApiBase = import.meta.env.VITE_API_BASE || "https://ing-soft-5shh.onrender.com";
export const API_BASE = rawApiBase.replace(/\/$/, "");

export const dbKeySession = "skillswap_session";
export const dbKeyEmail = "skillswap_email";
export const dbKeyToken = "skillswap_token";
export const dbKeyProfilePrefix = "skillswap_profile_";

export const languagesCatalog = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Russian", "Japanese"];
