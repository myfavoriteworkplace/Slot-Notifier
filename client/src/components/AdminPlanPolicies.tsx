import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileEdit, LockKeyhole, Save, Send, ShieldAlert } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { PlanFeatures, PlanKey, PlanPolicy, PlanPolicyDocument } from "@shared/plan-catalog";
import type { PlanPolicyVersion } from "@shared/schema";
import { calculateAnnualSavings, PLAN_KEYS } from "@shared/plan-catalog";
import { validatePlanPolicyDocument } from "@shared/plan-policy-validation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PoliciesResponse = {
  published: PlanPolicyVersion;
  versions: PlanPolicyVersion[];
  providerMappingStatus: Record<string, boolean>;
  liveCatalogVersion: string;
  liveConsumersUsePublishedRegistry: boolean;
};

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  analytics: "Analytics",
  export: "Export",
  inventory: "Inventory",
  pharmacy: "Pharmacy",
  website: "Website",
  support: "Support",
  publicProfile: "Public profile",
  verifiedBadge: "Verified badge",
  featuredDealPlacement: "Featured deal placement",
  essentialWhatsapp: "Essential WhatsApp",
  routineWhatsapp: "Routine WhatsApp",
  bulkWhatsapp: "Bulk WhatsApp",
  promotionalWhatsapp: "Promotional WhatsApp",
  advancedWhatsapp: "Advanced WhatsApp",
};

const FEATURE_OPTIONS: Partial<Record<keyof PlanFeatures, string[]>> = {
  analytics: ["basic_snapshot", "basic", "advanced", "full"],
  export: ["one_export", "standard", "advanced_scheduled", "full_priority"],
  inventory: ["limited_volume", "basic", "advanced", "full"],
  pharmacy: ["limited_volume", "basic", "advanced", "full"],
  website: ["trial_branding", "basic", "sections_theme", "custom_premium"],
  support: ["help_center_onboarding", "standard_email", "priority_email", "priority_email_phone"],
  publicProfile: ["trial_branding", "standard", "premium_visibility"],
};

const formatFeatureValue = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
const formatDate = (value: string | Date | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";
const cloneDocument = (document: PlanPolicyDocument): PlanPolicyDocument => JSON.parse(JSON.stringify(document)) as PlanPolicyDocument;

function NumberField({
  label,
  value,
  onChange,
  suffix,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          value={value ?? ""}
          disabled={disabled}
          placeholder={disabled ? "Not applicable" : "Unlimited"}
          onChange={event => {
            const raw = event.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
          className="h-8 text-xs"
        />
        {suffix && <span className="shrink-0 text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

export default function AdminPlanPolicies() {
  const [document, setDocument] = useState<PlanPolicyDocument | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("trial");
  const [reason, setReason] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [impactPreview, setImpactPreview] = useState<{
    changedPlans: Array<{ plan: string; changes: string[] }>;
    affectedActiveSubscriptions: Record<string, number>;
    existingSubscriptionsRepriced: boolean;
    enforcementChanged: boolean;
  } | null>(null);

  const policiesQuery = useQuery<PoliciesResponse>({
    queryKey: ["/api/admin/plan-policies"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/plan-policies")).json(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (policiesQuery.data?.published.document && !document) {
      setDocument(cloneDocument(policiesQuery.data.published.document));
    }
  }, [document, policiesQuery.data]);

  const validation = useMemo(
    () => document ? validatePlanPolicyDocument(document) : { errors: [], warnings: [] },
    [document],
  );
  const selectedPolicy = document?.plans[selectedPlan] ?? null;
  const policyData = policiesQuery.data;
  const drafts = policyData?.versions.filter(version => version.status === "draft") ?? [];
  const published = policyData?.published;

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!document) throw new Error("Load the policy before saving");
      const response = await apiRequest("POST", "/api/admin/plan-policies/drafts", { document, reason: reason.trim() });
      return response.json();
    },
    onSuccess: async () => {
      setReason("");
      notify.success("Policy draft saved", { description: "The draft is not live until it is explicitly published." });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/plan-policies"] });
    },
    onError: (error: Error) => notify.error(error.message || "Could not save policy draft"),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/admin/plan-policies/${id}/publish`, {
        reason: reason.trim(),
        confirm: true,
      });
      return response.json();
    },
    onSuccess: async () => {
      setReason("");
      setSelectedDraftId(null);
      notify.success("Policy published", { description: "Existing active subscriptions and live entitlement consumers were not changed." });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/plan-policies"] });
    },
    onError: (error: Error) => notify.error(error.message || "Could not publish policy"),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!document) throw new Error("Load the policy before previewing");
      const response = await apiRequest("POST", "/api/admin/plan-policies/preview", { document });
      return response.json();
    },
    onSuccess: (result) => {
      setImpactPreview(result.impact);
      if (result.errors?.length) {
        notify.error("Policy validation failed", { description: result.errors[0] });
      } else {
        notify.success("Impact preview ready", { description: "No active subscription will be repriced by publication." });
      }
    },
    onError: (error: Error) => notify.error(error.message || "Could not preview policy impact"),
  });

  const updateSelectedPlan = (update: (plan: PlanPolicy) => void) => {
    setDocument(current => {
      if (!current) return current;
      const next = cloneDocument(current);
      update(next.plans[selectedPlan]);
      return next;
    });
  };

  const updateLimit = (key: "bookings" | "activeDoctors" | "smileDeals", value: number | null) => {
    updateSelectedPlan(plan => {
      plan.limits[key].value = value;
      plan.limits[key].fairUse = selectedPlan === "pro" && value === null;
      if (selectedPlan === "pro" && value === null) plan.limits[key].period = "fair_use";
      if (selectedPlan !== "pro" && value !== null && plan.limits[key].period === "fair_use") plan.limits[key].period = "ongoing";
    });
  };

  const updateFeature = (key: keyof PlanFeatures, value: string | boolean) => {
    updateSelectedPlan(plan => {
      (plan.features as any)[key] = value;
    });
  };

  const loadDraft = (version: PlanPolicyVersion) => {
    setDocument(cloneDocument(version.document));
    setSelectedDraftId(version.id);
    setReason("");
  };

  if (policiesQuery.isLoading) {
    return <Card><CardContent className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">Loading plan policies…</CardContent></Card>;
  }

  if (policiesQuery.isError || !document || !published || !policyData) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="flex min-h-[180px] items-center justify-center gap-3 p-6 text-sm text-red-700 dark:text-red-300">
          <ShieldAlert className="h-4 w-4" /> Plan policy registry is unavailable.
          <Button variant="outline" size="sm" onClick={() => policiesQuery.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Plan policies</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configure the four-plan catalog without changing active clinic subscriptions.</p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <LockKeyhole className="h-3 w-3" /> Draft workflow
        </Badge>
      </div>

      <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 p-4 text-xs text-blue-900 dark:text-blue-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Safe configuration stage</p>
            <p className="mt-1 leading-5">
              Published policy versions are stored for review and audit. Live pricing, existing Razorpay subscriptions, and entitlement enforcement remain on the reviewed catalog version {policyData.liveCatalogVersion} until a separate cutover.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {PLAN_KEYS.map(key => {
          const plan = document.plans[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPlan(key)}
              className={`rounded-xl border p-4 text-left transition-colors ${selectedPlan === key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold">{plan.displayName}</span>
                {plan.recommended && <Badge className="text-[10px]">Recommended</Badge>}
              </div>
              <p className="mt-2 text-lg font-bold">{plan.pricing.monthly === null ? "Free" : `₹${plan.pricing.monthly.toLocaleString("en-IN")}/mo`}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{plan.pricing.annual === null ? "No paid cycle" : `₹${plan.pricing.annual.toLocaleString("en-IN")}/yr · save ₹${(calculateAnnualSavings(plan) ?? 0).toLocaleString("en-IN")}`}</p>
            </button>
          );
        })}
      </div>

      {selectedPolicy && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><FileEdit className="h-4 w-4 text-primary" />Edit {selectedPolicy.displayName}</CardTitle>
            <CardDescription>Changes are saved as a new immutable draft. They are not live until published.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs md:col-span-2">
                <span className="font-semibold text-muted-foreground">Public summary</span>
                <Textarea value={selectedPolicy.summary} onChange={event => updateSelectedPlan(plan => { plan.summary = event.target.value; })} className="min-h-[70px] text-xs" />
              </label>
              <NumberField label="Monthly price (₹)" value={selectedPolicy.pricing.monthly} disabled={selectedPlan === "trial"} onChange={value => updateSelectedPlan(plan => { plan.pricing.monthly = value; })} />
              <NumberField label="Annual price (₹)" value={selectedPolicy.pricing.annual} disabled={selectedPlan === "trial"} onChange={value => updateSelectedPlan(plan => { plan.pricing.annual = value; })} />
              <NumberField label="Bookings" value={selectedPolicy.limits.bookings.value} suffix={selectedPlan === "pro" ? "blank = fair use" : selectedPolicy.limits.bookings.period} onChange={value => updateLimit("bookings", value)} />
              <NumberField label="Active doctors" value={selectedPolicy.limits.activeDoctors.value} suffix={selectedPlan === "pro" ? "blank = fair use" : "ongoing"} onChange={value => updateLimit("activeDoctors", value)} />
              <NumberField label="Smile Deals" value={selectedPolicy.limits.smileDeals.value} suffix={selectedPlan === "pro" ? "blank = fair use" : "ongoing"} onChange={value => updateLimit("smileDeals", value)} />
              <NumberField label="Storage" value={Math.round(selectedPolicy.limits.storageBytes / (1024 * 1024))} suffix="MB" onChange={value => updateSelectedPlan(plan => { plan.limits.storageBytes = Math.max(1, (value ?? 1) * 1024 * 1024); })} />
              <NumberField label="SMS allowance" value={selectedPolicy.limits.messaging.sms} onChange={value => updateSelectedPlan(plan => { plan.limits.messaging.sms = value ?? 0; })} />
              <NumberField label="WhatsApp allowance" value={selectedPolicy.limits.messaging.whatsapp} onChange={value => updateSelectedPlan(plan => { plan.limits.messaging.whatsapp = value ?? 0; })} />
              <NumberField label="Email allowance" value={selectedPolicy.limits.messaging.email} onChange={value => updateSelectedPlan(plan => { plan.limits.messaging.email = value ?? 0; })} />
              {selectedPlan === "trial" && (
                <>
                  <NumberField label="Trial duration" value={selectedPolicy.trial.durationDays} suffix="days" onChange={value => updateSelectedPlan(plan => { plan.trial.durationDays = value; })} />
                  <NumberField label="Trial grace period" value={selectedPolicy.trial.graceDays} suffix="days" onChange={value => updateSelectedPlan(plan => { plan.trial.graceDays = value; })} />
                </>
              )}
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold">
                <input type="checkbox" checked={selectedPolicy.recommended} onChange={event => updateSelectedPlan(plan => { plan.recommended = event.target.checked; })} />
                Recommended plan
              </label>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Feature entitlements</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(FEATURE_LABELS) as Array<keyof PlanFeatures>).map(key => {
                  const value = selectedPolicy.features[key];
                  const options = FEATURE_OPTIONS[key];
                  return (
                    <label key={key} className="space-y-1 text-xs">
                      <span className="font-semibold text-muted-foreground">{FEATURE_LABELS[key]}</span>
                      {options ? (
                        <select value={String(value)} onChange={event => updateFeature(key, event.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-xs">
                          {options.map(option => <option key={option} value={option}>{formatFeatureValue(option)}</option>)}
                        </select>
                      ) : (
                        <span className="flex h-8 items-center gap-2 rounded-md border px-2">
                          <input type="checkbox" checked={Boolean(value)} onChange={event => updateFeature(key, event.target.checked)} />
                          {value ? "Included" : "Not included"}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
                <p className="font-semibold">Fix before saving</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">{validation.errors.map(error => <li key={error}>{error}</li>)}</ul>
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-semibold">Review warnings</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">{validation.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}

            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="space-y-1 text-xs">
                <span className="font-semibold text-muted-foreground">Change reason (minimum 10 characters)</span>
                <Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this policy change is being prepared." className="min-h-[70px] text-xs" maxLength={500} />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={validation.errors.length > 0 || previewMutation.isPending}>
                  <ShieldAlert className="mr-1.5 h-4 w-4" />{previewMutation.isPending ? "Checking…" : "Validate & preview"}
                </Button>
                <Button onClick={() => saveDraftMutation.mutate()} disabled={validation.errors.length > 0 || reason.trim().length < 10 || saveDraftMutation.isPending}>
                  <Save className="mr-1.5 h-4 w-4" />{saveDraftMutation.isPending ? "Saving…" : "Save draft"}
                </Button>
              </div>
            </div>
            {impactPreview && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
                <p className="font-semibold">Impact preview</p>
                <p className="mt-1">Existing subscriptions repriced: <strong>{impactPreview.existingSubscriptionsRepriced ? "Yes" : "No"}</strong>. Entitlement enforcement changed: <strong>{impactPreview.enforcementChanged ? "Yes" : "No"}</strong>.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {impactPreview.changedPlans.length === 0
                    ? <Badge variant="outline">No changes from published policy</Badge>
                    : impactPreview.changedPlans.map(change => <Badge key={change.plan} variant="outline">{change.plan}: {change.changes.join(", ")}</Badge>)}
                </div>
                <p className="mt-2 text-[11px] opacity-80">
                  Active clinics by plan: {Object.entries(impactPreview.affectedActiveSubscriptions).map(([plan, count]) => `${plan} ${count}`).join(" · ") || "none"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Provider mapping status</CardTitle><CardDescription>Mapping IDs stay server-side; only readiness is shown.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {Object.entries(policyData.providerMappingStatus).map(([key, configured]) => (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                <span className="font-medium">{key}</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${configured ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{configured ? "Ready" : "Not configured"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Policy versions</CardTitle><CardDescription>Published versions are immutable. Load a draft to review or publish it.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {drafts.length === 0 && <p className="text-xs text-muted-foreground">No drafts saved yet.</p>}
            {drafts.slice(0, 6).map(version => (
              <div key={version.id} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${selectedDraftId === version.id ? "border-primary bg-primary/5" : ""}`}>
                <button type="button" className="min-w-0 text-left" onClick={() => loadDraft(version)}>
                  <p className="truncate text-xs font-semibold">{version.version}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(version.createdAt)} · {version.createdBy}</p>
                </button>
                <Button
                  size="sm"
                  className="h-7 shrink-0 text-[11px]"
                  onClick={() => {
                    if (selectedDraftId !== version.id) {
                      loadDraft(version);
                      notify.success("Draft loaded", { description: "Review it, enter a publish reason, then select Publish again." });
                      return;
                    }
                    if (window.confirm(`Publish policy ${version.version}? Existing active subscriptions will not be repriced.`)) {
                      publishMutation.mutate(version.id);
                    }
                  }}
                  disabled={publishMutation.isPending || (selectedDraftId === version.id && reason.trim().length < 10)}
                >
                  <Send className="mr-1 h-3 w-3" />{selectedDraftId === version.id ? "Publish" : "Load"}
                </Button>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">Publishing requires a separate reason in the editor above and does not reprice active subscriptions.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}