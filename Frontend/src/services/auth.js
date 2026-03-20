import { api, getAuthToken, setAuthToken } from "./api.js";
import { API_BASE, dbKeySession } from "../config/constants.js";

export async function registerUser(name, email, password) {
  const payload = { name, email: email.toLowerCase().trim(), password };
  const result = await api(API_BASE, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.user;
}

export async function loginUser(email, password) {
  const formData = new URLSearchParams();
  formData.append("username", email.toLowerCase().trim());
  formData.append("password", password);

  const result = await api(API_BASE, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  setAuthToken(result.access_token);
  localStorage.setItem(dbKeySession, email.toLowerCase().trim());
  return result;
}

export async function getCurrentUser() {
  try {
    const userId = localStorage.getItem(dbKeySession);
    if (!userId) return null;
    const result = await api(API_BASE, `/api/usuarios/${encodeURIComponent(userId)}`);
    return result.user;
  } catch {
    return null;
  }
}

export function logout() {
  setAuthToken(null);
  localStorage.removeItem(dbKeySession);
}
