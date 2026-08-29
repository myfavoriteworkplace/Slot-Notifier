export interface RealEmailPolicyInput {
  nodeEnv: string;
  resendMode: string | undefined;
  hasApiKey: boolean;
}

/**
 * Real delivery is available only to compiled deployments with an explicit
 * Resend production mode and a configured API key.
 */
export function canSendRealEmail({
  nodeEnv,
  resendMode,
  hasApiKey,
}: RealEmailPolicyInput): boolean {
  return (
    nodeEnv === "production" &&
    resendMode?.trim().toUpperCase() === "PRODUCTION" &&
    hasApiKey
  );
}