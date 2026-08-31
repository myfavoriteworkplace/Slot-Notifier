export const APP_ENV_VALUES = ["production", "development"] as const;

export type AppEnvironment = (typeof APP_ENV_VALUES)[number];
export type TechnicalEnvironment = "production" | "development" | "test";

export interface RuntimeEnvironment {
  appEnv: AppEnvironment;
  nodeEnv: string;
  isStrict: boolean;
  isTest: boolean;
  isLocalDevelopment: boolean;
}

const isAppEnvironment = (value: string): value is AppEnvironment =>
  (APP_ENV_VALUES as readonly string[]).includes(value);

/**
 * Resolve the application label without silently treating invalid values as local.
 *
 * APP_ENV intentionally has only two values. Local development is represented by
 * APP_ENV=development together with NODE_ENV=development.
 */
export function resolveAppEnv(
  appEnv: string | undefined,
  nodeEnv: string | undefined,
): AppEnvironment {
  const explicitAppEnv = appEnv?.trim().toLowerCase();

  if (explicitAppEnv) {
    if (!isAppEnvironment(explicitAppEnv)) {
      throw new Error(
        `APP_ENV must be one of: ${APP_ENV_VALUES.join(", ")}. Received: ${appEnv}`,
      );
    }
    return explicitAppEnv;
  }

  // Compatibility fallback while existing deployments receive APP_ENV.
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "development" || nodeEnv === "test" || !nodeEnv) {
    return "development";
  }

  throw new Error(
    `APP_ENV is missing and NODE_ENV is unsupported for fallback: ${nodeEnv}`,
  );
}

export function resolveRuntimeEnvironment(
  appEnv = process.env.APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): RuntimeEnvironment {
  const resolvedNodeEnv = nodeEnv || "development";
  const resolvedAppEnv = resolveAppEnv(appEnv, resolvedNodeEnv);

  // Production application labels must use the compiled production runtime.
  // Development supports both the deployed compiled runtime and local/test
  // technical runtimes.
  if (resolvedAppEnv === "production" && resolvedNodeEnv !== "production") {
    throw new Error(
      `APP_ENV=production requires NODE_ENV=production. Received NODE_ENV=${resolvedNodeEnv}`,
    );
  }

  return {
    appEnv: resolvedAppEnv,
    nodeEnv: resolvedNodeEnv,
    isStrict: resolvedNodeEnv === "production",
    isTest: resolvedNodeEnv === "test",
    isLocalDevelopment: resolvedNodeEnv === "development",
  };
}