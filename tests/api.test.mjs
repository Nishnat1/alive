import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearToken, fetchJSON } from "../lib/api.js";

let originalFetch;
let originalWindow;
let localStorage;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalWindow = globalThis.window;
  const values = new Map([["fittrack-token", "test-token"]]);
  localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
    values,
  };
  globalThis.window = { localStorage };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

test("fetchJSON adds bearer auth without forcing a content type on GET", async () => {
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response(JSON.stringify({ workouts: [] }), { status: 200 });
  };

  const { data } = await fetchJSON("https://fittrack-backend-urcn.onrender.com/workouts");

  assert.deepEqual(data, { workouts: [] });
  assert.equal(requestOptions.headers.get("Authorization"), "Bearer test-token");
  assert.equal(requestOptions.headers.has("Content-Type"), false);
});

test("fetchJSON sets JSON content type for request bodies", async () => {
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response("{}", { status: 201 });
  };

  await fetchJSON("https://fittrack-backend-urcn.onrender.com/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "test@example.com" }),
  });

  assert.equal(requestOptions.headers.get("Content-Type"), "application/json");
});

test("fetchJSON preserves a caller-provided authorization header", async () => {
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response("{}", { status: 200 });
  };

  await fetchJSON("https://fittrack-backend-urcn.onrender.com/resource", {
    headers: new Headers({ authorization: "Custom credential" }),
  });

  assert.equal(
    requestOptions.headers.get("Authorization"),
    "Custom credential"
  );
});

test("fetchJSON exposes API detail and status on failed responses", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: [{ msg: "Invalid request" }] }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(fetchJSON("https://fittrack-backend-urcn.onrender.com/workouts"), (error) => {
    assert.equal(error.message, "Invalid request");
    assert.equal(error.status, 422);
    return true;
  });
});

test("clearToken removes both authentication and cached user data", () => {
  localStorage.setItem("fittrack-user", '{"name":"Test User"}');

  clearToken();

  assert.equal(localStorage.getItem("fittrack-token"), null);
  assert.equal(localStorage.getItem("fittrack-user"), null);
});
