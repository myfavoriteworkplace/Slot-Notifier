import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppEnv, resolveRuntimeEnvironment } from "./environment";
import { canSendRealEmail } from "./email-policy";

test("accepts the two application environments", () => {
  assert.equal(resolveAppEnv("production", "production"), "production");
  assert.equal(resolveAppEnv("development", "production"), "development");
});

test("local development uses the development application label", () => {
  const runtime = resolveRuntimeEnvironment("development", "development");

  assert.equal(runtime.appEnv, "development");
  assert.equal(runtime.isLocalDevelopment, true);
  assert.equal(runtime.isStrict, false);
});

test("deployed development uses the same strict runtime as production", () => {
  const development = resolveRuntimeEnvironment("development", "production");
  const production = resolveRuntimeEnvironment("production", "production");

  assert.equal(development.isStrict, true);
  assert.equal(production.isStrict, true);
  assert.equal(development.nodeEnv, production.nodeEnv);
});

test("test execution is development-labelled but never strict", () => {
  const runtime = resolveRuntimeEnvironment(undefined, "test");

  assert.equal(runtime.appEnv, "development");
  assert.equal(runtime.isTest, true);
  assert.equal(runtime.isStrict, false);
});

test("missing APP_ENV falls back safely during migration", () => {
  assert.equal(resolveAppEnv(undefined, "production"), "production");
  assert.equal(resolveAppEnv(undefined, "development"), "development");
});

test("unknown APP_ENV values are rejected", () => {
  assert.throws(
    () => resolveAppEnv("staging", "production"),
    /APP_ENV must be one of: production, development/,
  );
});

test("production cannot use the local technical runtime", () => {
  assert.throws(
    () => resolveRuntimeEnvironment("production", "development"),
    /APP_ENV=production requires NODE_ENV=production/,
  );
});

test("production and deployed development can both send real email", () => {
  const input = {
    resendMode: "PRODUCTION",
    hasApiKey: true,
  };

  assert.equal(
    canSendRealEmail({ ...input, nodeEnv: "production" }),
    true,
  );
});

test("local and test runtimes cannot send real email", () => {
  const input = {
    resendMode: "PRODUCTION",
    hasApiKey: true,
  };

  assert.equal(canSendRealEmail({ ...input, nodeEnv: "development" }), false);
  assert.equal(canSendRealEmail({ ...input, nodeEnv: "test" }), false);
});