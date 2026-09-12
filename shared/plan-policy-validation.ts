import {
  BILLING_CYCLES,
  PLAN_KEYS,
  calculateAnnualSavings,
  type PlanPolicyDocument,
} from "./plan-catalog";

export type PlanPolicyValidation = {
  errors: string[];
  warnings: string[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function validatePlanPolicyDocument(document: unknown): PlanPolicyValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(document)) {
    return { errors: ["Policy document must be an object."], warnings };
  }

  if (document.status !== "draft" && document.status !== "published") {
    errors.push("Policy status must be draft or published.");
  }

  if (!isObject(document.plans)) {
    return { errors: [...errors, "Policy must contain all four plan definitions."], warnings };
  }

  for (const key of PLAN_KEYS) {
    const plan = document.plans[key];
    if (!isObject(plan)) {
      errors.push(`Missing ${key} plan definition.`);
      continue;
    }

    if (plan.key !== key) errors.push(`${key} plan key is inconsistent.`);
    if (typeof plan.displayName !== "string" || !plan.displayName.trim()) {
      errors.push(`${key} needs a display name.`);
    }
    if (typeof plan.summary !== "string" || !plan.summary.trim()) {
      errors.push(`${key} needs a public summary.`);
    }

    const pricing = isObject(plan.pricing) ? plan.pricing : null;
    if (!pricing) {
      errors.push(`${key} needs pricing values.`);
    } else {
      const monthly = pricing.monthly;
      const annual = pricing.annual;
      const isTrial = key === "trial";
      if (isTrial) {
        if (monthly !== null || annual !== null) {
          errors.push("Trial must not have paid monthly or annual prices.");
        }
      } else {
        if (!isFiniteNonNegative(monthly) || monthly <= 0) errors.push(`${key} needs a positive monthly price.`);
        if (!isFiniteNonNegative(annual) || annual <= 0) errors.push(`${key} needs a positive annual price.`);
        if (isFiniteNonNegative(monthly) && isFiniteNonNegative(annual) && annual > monthly * 12) {
          errors.push(`${key} annual price cannot exceed twelve monthly payments.`);
        }
      }
    }

    const limits = isObject(plan.limits) ? plan.limits : null;
    if (!limits) {
      errors.push(`${key} needs usage limits.`);
    } else {
      for (const limitKey of ["bookings", "activeDoctors", "smileDeals"] as const) {
        const limit = isObject(limits[limitKey]) ? limits[limitKey] : null;
        if (!limit || (!isFiniteNonNegative(limit.value) && limit.value !== null)) {
          errors.push(`${key} needs a valid ${limitKey} limit.`);
        }
      }
      if (!isFiniteNonNegative(limits.storageBytes) || limits.storageBytes <= 0) {
        errors.push(`${key} needs a positive storage limit.`);
      }
      const messaging = isObject(limits.messaging) ? limits.messaging : null;
      if (!messaging) {
        errors.push(`${key} needs SMS, WhatsApp, and email allowances.`);
      } else {
        for (const channel of ["sms", "whatsapp", "email"] as const) {
          if (!isFiniteNonNegative(messaging[channel])) {
            errors.push(`${key} needs a valid ${channel} allowance.`);
          }
        }
      }
    }

    if (key === "trial" && (!isObject(plan.trial) || !isFiniteNonNegative(plan.trial.durationDays) || plan.trial.durationDays <= 0)) {
      errors.push("Trial needs a positive duration.");
    }

    const features = isObject(plan.features) ? plan.features : null;
    if (!features) {
      errors.push(`${key} needs feature entitlements.`);
    } else {
      const featureKeys = [
        "analytics", "export", "inventory", "pharmacy", "website", "support",
        "publicProfile", "verifiedBadge", "featuredDealPlacement", "essentialWhatsapp",
        "routineWhatsapp", "bulkWhatsapp", "promotionalWhatsapp", "advancedWhatsapp",
      ] as const;
      for (const featureKey of featureKeys) {
        const value = features[featureKey];
        if (typeof value !== "string" && typeof value !== "boolean") {
          errors.push(`${key} needs a valid ${featureKey} entitlement.`);
        }
      }
    }
  }

  const plans = document.plans as Record<string, unknown>;
  const recommendedPlans = PLAN_KEYS.filter(key => isObject(plans[key]) && plans[key].recommended === true);
  if (recommendedPlans.length > 1) warnings.push("More than one plan is marked as recommended.");
  if (!recommendedPlans.length) warnings.push("No plan is marked as recommended.");

  for (const key of PLAN_KEYS) {
    const plan = document.plans[key] as any;
    if (!plan || !isObject(plan.pricing)) continue;
    const savings = calculateAnnualSavings(plan);
    if (savings !== null && savings < 0) errors.push(`${key} annual savings cannot be negative.`);
  }

  if (!isObject(document.explicitDeferrals)) {
    errors.push("Policy must preserve explicit commercial deferrals.");
  } else {
    for (const key of ["transactionFees", "inventoryItemCounts", "pharmacyItemCounts"]) {
      if (document.explicitDeferrals[key] !== "deferred") {
        warnings.push(`${key} is no longer marked deferred; confirm the commercial policy before publishing.`);
      }
    }
  }

  if (!BILLING_CYCLES.every(cycle => cycle === "monthly" || cycle === "annual")) {
    errors.push("Billing-cycle catalog is invalid.");
  }

  return { errors, warnings };
}