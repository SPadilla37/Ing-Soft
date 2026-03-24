import { dbKeyToken } from "../config/constants.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function toErrorMessage(payload) {
  if (!payload) return "Error inesperado";

  const detail = payload.detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first === "object") {
      if (typeof first.msg === "string") return first.msg;
      if (typeof first.message === "string") return first.message;
    }
    return detail.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" | ");
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg;
    if (typeof detail.message === "string") return detail.message;
    return JSON.stringify(detail);
  }

  if (typeof payload.message === "string") return payload.message;
  return JSON.stringify(payload);
}


export async function api(apiBase, path, options = {}) {
  const token = localStorage.getItem(dbKeyToken);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(`${apiBase}${path}`, {
        headers,
        ...options,
      });
      break;
    } catch (error) {
      if (attempt < maxAttempts) {
        await sleep(600);
        continue;
      }
      throw new Error("No se pudo conectar al servidor. Verifica tu conexion e intenta de nuevo.");
    }
  }

  if (!response) {
    throw new Error("No se pudo conectar al servidor. Verifica tu conexion e intenta de nuevo.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(toErrorMessage(data));
  }

  return data;
}
