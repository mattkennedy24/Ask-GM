import { describe, expect, it } from "vitest";
import { createBetaAuth, safeEqual } from "../lib/betaAuth.js";
import { loadConfig, normalizeSecret, parseTrustProxy } from "../config.js";

function run(auth, headerValue) {
  const result = { passed: false, status: undefined, body: undefined };
  const req = { get: (name) => (name.toLowerCase() === "x-beta-key" ? headerValue : undefined) };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  auth.middleware(req, res, () => {
    result.passed = true;
  });
  return result;
}

describe("createBetaAuth", () => {
  it("is open and reports required=false when no passcode is configured", () => {
    const auth = createBetaAuth("");
    expect(auth.required).toBe(false);
    expect(run(auth, undefined).passed).toBe(true);
    expect(auth.isValidKey("anything")).toBe(true);
  });

  it("rejects a missing key with 401 and a machine-readable code", () => {
    const result = run(createBetaAuth("sesame"), undefined);
    expect(result.passed).toBe(false);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Beta access required", code: "BETA_KEY_INVALID" });
  });

  it("rejects a wrong key — this is the case the old client-only check let through", () => {
    expect(run(createBetaAuth("sesame"), "totally-wrong-code").status).toBe(401);
  });

  it("accepts the right key, ignoring surrounding whitespace", () => {
    const auth = createBetaAuth("sesame");
    expect(run(auth, "sesame").passed).toBe(true);
    expect(run(auth, "  sesame \n").passed).toBe(true);
  });

  it("is case-sensitive", () => {
    expect(run(createBetaAuth("Sesame"), "sesame").status).toBe(401);
  });

  it("rejects empty, non-string and oversized keys without throwing", () => {
    const auth = createBetaAuth("sesame");
    expect(auth.isValidKey("")).toBe(false);
    expect(auth.isValidKey("   ")).toBe(false);
    expect(auth.isValidKey(undefined)).toBe(false);
    expect(auth.isValidKey(["sesame"])).toBe(false);
    expect(auth.isValidKey("x".repeat(5000))).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares values of different lengths without throwing", () => {
    expect(safeEqual("a", "abcdef")).toBe(false);
    expect(safeEqual("same", "same")).toBe(true);
  });
});

describe("config normalisation", () => {
  it("strips whitespace and one layer of wrapping quotes from secrets", () => {
    expect(normalizeSecret('  "my-code" \n')).toBe("my-code");
    expect(normalizeSecret("'my-code'")).toBe("my-code");
    expect(normalizeSecret("my-code\n")).toBe("my-code");
    expect(normalizeSecret('"unbalanced')).toBe('"unbalanced');
    expect(normalizeSecret(undefined)).toBe("");
  });

  it("makes a quoted Railway variable still match what the user types", () => {
    const { betaPasscode } = loadConfig({ BETA_PASSCODE: '"let-me-in"\n' });
    expect(createBetaAuth(betaPasscode).isValidKey("let-me-in")).toBe(true);
  });

  it("trusts exactly one proxy hop in production, none in development", () => {
    expect(parseTrustProxy(undefined, true)).toBe(1);
    expect(parseTrustProxy(undefined, false)).toBe(false);
    expect(parseTrustProxy("2", true)).toBe(2);
    expect(parseTrustProxy("false", true)).toBe(false);
    expect(parseTrustProxy("true", false)).toBe(true);
  });

  it("treats the placeholder API key as unset", () => {
    expect(loadConfig({ ANTHROPIC_API_KEY: "your-api-key-here" }).hasApiKey).toBe(false);
    expect(loadConfig({ ANTHROPIC_API_KEY: "sk-ant-real" }).hasApiKey).toBe(true);
    expect(loadConfig({}).port).toBe(3001);
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
    expect(loadConfig({ PORT: "nonsense" }).port).toBe(3001);
  });
});
