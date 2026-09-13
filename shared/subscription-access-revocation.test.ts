import test from "node:test";
import assert from "node:assert/strict";
import {
  getAccessRevocationEventType,
  isAccessRevocable,
} from "./subscription-access-revocation";

const now = new Date("2026-09-13T00:00:00.000Z");

test("maps access kinds to append-only revocation events", () => {
  assert.equal(getAccessRevocationEventType("sponsored_access"), "sponsored_access_revoked");
  assert.equal(getAccessRevocationEventType("entitlement_exception"), "exception_revoked");
});

test("only active, non-revoked access can be revoked", () => {
  assert.equal(isAccessRevocable({ revokedAt: null, endsAt: "2026-09-14T00:00:00.000Z" }, now), true);
  assert.equal(isAccessRevocable({ revokedAt: null, endsAt: "2026-09-12T00:00:00.000Z" }, now), false);
  assert.equal(isAccessRevocable({ revokedAt: "2026-09-12T00:00:00.000Z", endsAt: "2026-09-14T00:00:00.000Z" }, now), false);
});