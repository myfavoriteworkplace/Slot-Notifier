export type RevocableAccessKind = "sponsored_access" | "entitlement_exception";

export function getAccessRevocationEventType(kind: RevocableAccessKind) {
  return kind === "sponsored_access" ? "sponsored_access_revoked" : "exception_revoked";
}

export function isAccessRevocable(
  access: { revokedAt: Date | string | null; endsAt: Date | string },
  now = new Date(),
) {
  if (access.revokedAt) return false;
  const endsAt = new Date(access.endsAt);
  return Number.isFinite(endsAt.getTime()) && endsAt > now;
}