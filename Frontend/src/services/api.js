import { dbKeyToken } from "../config/constants.js";


export async function api(apiBase, path, options = {}) {
  const token = localStorage.getItem(dbKeyToken);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${apiBase}${path}`, {
    headers,
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || JSON.stringify(data));
  }
  return data;
}
