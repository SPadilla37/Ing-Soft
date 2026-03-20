let token = localStorage.getItem("auth_token");

export async function api(apiBase, path, options = {}) {
  const headers = { 
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `${apiBase}${path}`;
  let response;
  try {
    response = await fetch(url, {
      headers,
      ...options,
    });
  } catch (err) {
    throw new Error(`Fetch failed for ${url}: ${err?.message || String(err)}`);
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || JSON.stringify(data));
  }
  return data;
}

export function setAuthToken(newToken) {
  token = newToken;
  if (newToken) {
    localStorage.setItem("auth_token", newToken);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken() {
  return token;
}
