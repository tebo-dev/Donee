const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "donee_access_token";

function getBaseUrl() {
  return DEFAULT_BASE_URL;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request(path, options = {}) {
  const {
    method = "GET",
    body = null,
    headers = {},
    auth = true,
  } = options;

  const url = `${getBaseUrl()}${path}`;

  const finalHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : null,
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = text ? { message: text } : null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Request failed (${res.status})`;

    const message = Array.isArray(msg)
      ? msg.map((e) => `${e.loc?.join(".")}: ${e.msg}`).join("\n")
      : msg;

    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
