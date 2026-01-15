import { request, setToken, clearToken } from "./api.js";

export async function register({ email, username, password }) {
  return request("/auth/register", {
    method: "POST",
    body: { email, username, password },
    auth: false,
  });
}

export async function login({ email, password }) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });

  if (data?.access_token) {
    setToken(data.access_token);
  }
  return data;
}

export function logout() {
  clearToken();
}

export async function me() {
  return request("/auth/me", {
    method: "GET",
    auth: true,
  });
}

// Password reset flow

export async function forgotPassword({ email }) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export async function verifyResetCode({ email, code }) {
  return request("/auth/verify-reset-code", {
    method: "POST",
    body: { email, code },
    auth: false,
  });
}

export async function resetPassword({ email, code, new_password }) {
  return request("/auth/reset-password", {
    method: "POST",
    body: { email, code, new_password },
    auth: false,
  });
}
