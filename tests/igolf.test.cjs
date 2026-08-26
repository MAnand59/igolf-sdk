const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { test } = require("node:test");

const { IGolfController, IGOLF_SIGN_METHOD } = require("../dist");

function config(overrides = {}) {
  return {
    baseUrl: "https://api.example.com/",
    appKey: "test-app-key",
    apiVersion: "1.0",
    signVersion: "1.0",
    signMethod: IGOLF_SIGN_METHOD,
    appSecret: "test-secret",
    ...overrides,
  };
}

function controllerWithFetch(fetchImplementation, overrides = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImplementation;
  try {
    return new IGolfController(config(overrides));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("creates a correctly signed POST request and returns successful data", async () => {
  let capturedUrl;
  let capturedInit;
  const responseBody = { Status: 1, Courses: [{ Id: 42, Name: "Example Golf Club" }] };
  const controller = controllerWithFetch(async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  const result = await controller.requestWithActionCode("CourseList", { radius: 25 });

  assert.deepEqual(result, { stat: true, data: responseBody });
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers.Accept, "application/json");
  assert.equal(capturedInit.headers["Content-Type"], "application/json");
  assert.equal(capturedInit.body, JSON.stringify({ radius: 25 }));

  const parsedUrl = new URL(capturedUrl);
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  assert.deepEqual(segments.slice(0, 3), ["rest", "action", "CourseList"]);
  assert.equal(segments[3], "test-app-key");
  assert.equal(segments[4], "1.0");
  assert.equal(segments[5], "1.0");
  assert.equal(segments[6], "HMAC-SHA256");
  assert.match(segments[8], /^\d{12}[+-]\d{4}$/);
  assert.equal(segments[9], "JSON");

  const stringToSign = [
    "CourseList",
    "test-app-key",
    "1.0",
    "1.0",
    "HMAC-SHA256",
    segments[8],
    "JSON",
  ].join("/");
  const expectedSignature = createHmac("sha256", "test-secret")
    .update(stringToSign, "utf8")
    .digest("base64url");
  assert.equal(segments[7], expectedSignature);
});

test("does not append rest/action twice", async () => {
  let capturedUrl;
  const controller = controllerWithFetch(async (url) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({ Status: 1 }), { status: 200 });
  }, { baseUrl: "https://api.example.com/rest/action/" });

  await controller.requestWithActionCode("CourseList");
  assert.match(capturedUrl, /^https:\/\/api\.example\.com\/rest\/action\/CourseList\//);
  assert.doesNotMatch(capturedUrl, /rest\/action\/rest\/action/);
});

test("reports an iGolf-declared failure as stat false", async () => {
  const controller = controllerWithFetch(async () => new Response(
    JSON.stringify({ Status: 0, Message: "Invalid application key" }),
    { status: 200 },
  ));

  assert.deepEqual(
    await controller.requestWithActionCode("CourseList"),
    { stat: false, data: "Invalid application key" },
  );
});

test("preserves an API message for non-2xx responses", async () => {
  const controller = controllerWithFetch(async () => new Response(
    JSON.stringify({ message: "Request is not authorized" }),
    { status: 401, statusText: "Unauthorized" },
  ));

  assert.deepEqual(
    await controller.requestWithActionCode("CourseList"),
    { stat: false, data: "Request is not authorized" },
  );
});

test("reports unexpected successful response bodies", async () => {
  const controller = controllerWithFetch(async () => new Response("not-json", { status: 200 }));

  assert.deepEqual(
    await controller.requestWithActionCode("CourseList"),
    { stat: false, data: "The iGolf API returned an unexpected response." },
  );
});

test("reports transport errors without throwing", async () => {
  const controller = controllerWithFetch(async () => {
    throw new Error("socket disconnected");
  });

  assert.deepEqual(
    await controller.requestWithActionCode("CourseList"),
    { stat: false, data: "socket disconnected" },
  );
});

test("times out requests", async () => {
  const controller = controllerWithFetch((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  }), { timeoutMs: 10 });

  assert.deepEqual(
    await controller.requestWithActionCode("CourseList"),
    { stat: false, data: "The iGolf request timed out after 10 ms." },
  );
});

test("supports caller cancellation", async () => {
  const controller = controllerWithFetch(async (_url, init) => {
    assert.equal(init.signal.aborted, true);
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });
  const abortController = new AbortController();
  abortController.abort();

  assert.deepEqual(
    await controller.requestWithActionCode("CourseList", {}, { signal: abortController.signal }),
    { stat: false, data: "The iGolf request was cancelled." },
  );
});

test("validates configuration and request inputs", async () => {
  assert.throws(
    () => new IGolfController(config({ baseUrl: "not-a-url" })),
    /baseUrl must be a valid absolute URL/,
  );
  assert.throws(
    () => new IGolfController(config({ signMethod: "MD5" })),
    /signMethod must be HMAC-SHA256/,
  );
  assert.throws(
    () => new IGolfController(config({ timeoutMs: 0 })),
    /timeoutMs must be an integer/,
  );

  const controller = controllerWithFetch(async () => new Response("{}", { status: 200 }));
  await assert.rejects(() => controller.requestWithActionCode(" ", {}), /actionCode must be a non-empty string/);
  await assert.rejects(() => controller.requestWithActionCode("Course/List", {}), /single URL path segment/);
  await assert.rejects(() => controller.requestWithActionCode("CourseList", []), /params must be an object/);
});
