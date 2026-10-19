"use client";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const TOKEN_KEY = "fittrack-token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem("fittrack-user");
}

export async function fetchJSON(url, options = {}) {
  const headers = new Headers(options.headers);

  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail =
      data && typeof data === "object"
        ? Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg || item).join(" ")
          : data.detail
        : data;

    const error = new Error(detail || `Request failed (${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return { response, data };
}
