import { useState } from "react";
import { useLocation } from "wouter";
import { Check, X, Zap, Building2, ShieldCheck, ArrowRight, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: Zap,
    description: "Perfect for single-chair clinics getting started online.",
    monthly: 999,
    annual: 9990,
    annualMonthly: 833,
    transactionFee: "5%",
    bookings: "Up to 30 / mo",
    doctors: "1 doctor",
    deals: "1 deal post",
    badge: false,
    featured: false,
    whatsapp: false,
    analytics: "Basic",
    support: "None",
    popular: false,
    color: "border-border",
    headerBg: "bg-secondary/50 dark:bg-secondary/30",
    iconBg: "bg-primary/10 border-primary/20",
    iconColor: "text-primary",
  },
  {
    id: "growth",
    name: "Growth",
    icon: Building2,
    description: "Ideal for 2–3 chair clinics ready to grow their patient base.",
    monthly: 1599,
    annual: 15990,
    annualMonthly: 1333,
    transactionFee: "3%",
    bookings: "Up to 150 / mo",
    doctors: "Up to 3 doctors",
    deals: "3 deal posts",
    badge: false,
    featured: false,
    whatsapp: true,
    analytics: "Advanced",
    support: "Email",
    popular: true,
    color: "border-primary/50",
    headerBg: "bg-gradient-to-r from-primary/90 via-primary to-accent/80",
    iconBg: "bg-white/15 border-white/25",
    iconColor: "text-white",
  },
  {
    id: "pro",
    name: "Pro",
    icon: ShieldCheck,
    description: "For premium clinics that want maximum visibility and reach.",
    monthly: 2999,
    annual: 29990,
    annualMonthly: 2499,
    transactionFee: "1.5%",
    bookings: "Unlimited",
    doctors: "Unlimited doctors",
    deals: "Unlimited deal posts",
    badge: true,
    featured: true,
    whatsapp: true,
    analytics: "Full",
    support: "Email + Phone",
    popular: false,
    color: "border-border",
    headerBg: "bg-secondary/50 dark:bg-secondary/30",
    iconBg: "bg-primary/10 border-primary/20",
    iconColor: "text-primary",
  },
];

const COMPARISON_ROWS = [
  { label: "Monthly bookings", starter: "30", growth: "150", pro: "Unlimited" },
  { label: "Transaction fee per booking", starter: "5%", growth: "3%", pro: "1.5%" },
  { label: "Doctors on roster", starter: "1", growth: "3", pro: "Unlimited" },
  { label: "Smile Deal posts", starter: "1", growth: "3", pro: "Unlimited" },
  { label: "WhatsApp booking alerts", starter: false, growth: true, pro: true },
  { label: "Analytics dashboard", starter: "Basic", growth: "Advanced", pro: "Full" },
  { label: "Premium verified badge", starter: false, growth: false, pro: true },
  { label: "Featured placement on deals", starter: false, growth: false, pro: true },
  { label: "Priority support", starter: "—", growth: "Email", pro: "Email + Phone" },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value
      ? <Check className="h-4 w-4 text-primary mx-auto" />
      : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  }
  return <span className="text-sm text-foreground font-medium">{value}</span>;
}

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background px-4 py-16 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative max-w-5xl mx-auto">

        {/* Back button */}
        <button
          type="button"
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/getting-started")}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors mb-8"
          data-testid="button-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest mb-5">
            <Sparkles className="h-3 w-3" />
            Clinic Plans
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto mb-8">
            No hidden fees. No setup charges. Pick the plan that fits your clinic — upgrade anytime.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-1 bg-secondary/60 dark:bg-secondary/30 border border-border rounded-xl p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${!annual ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="toggle-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${annual ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="toggle-annual"
            >
              Annual
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${annual ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                2 months free
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = annual ? plan.annualMonthly : plan.monthly;
            const isGrowth = plan.popular;

            return (
              <div
                key={plan.id}
                data-testid={`plan-card-${plan.id}`}
                className={`relative rounded-2xl border ${plan.color} bg-background shadow-md overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${isGrowth ? "ring-2 ring-primary/40 shadow-primary/10" : ""}`}
              >
                {/* Most Popular badge */}
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px z-10">
                    <div className="bg-gradient-to-r from-primary to-accent text-white text-[10px] font-black uppercase tracking-widest px-5 py-1 rounded-b-lg shadow-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Card header */}
                <div className={`relative ${plan.headerBg} px-5 pt-6 pb-5 overflow-hidden ${isGrowth ? "" : ""}`}>
                  {isGrowth && (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />
                  )}
                  <div className="relative flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-xl ${plan.iconBg} border flex items-center justify-center shrink-0`}>
                      <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isGrowth ? "text-white/55" : "text-muted-foreground"}`}>Plan</p>
                      <h2 className={`text-lg font-extrabold tracking-tight ${isGrowth ? "text-white" : "text-foreground"}`}>{plan.name}</h2>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="relative">
                    <div className={`text-4xl font-black tracking-tight ${isGrowth ? "text-white" : "text-foreground"}`}>
                      ₹{price.toLocaleString("en-IN")}
                      <span className={`text-sm font-semibold ml-1 ${isGrowth ? "text-white/60" : "text-muted-foreground"}`}>/mo</span>
                    </div>
                    {annual && (
                      <p className={`text-xs mt-1 ${isGrowth ? "text-white/55" : "text-muted-foreground"}`}>
                        Billed as ₹{plan.annual.toLocaleString("en-IN")}/year
                      </p>
                    )}
                  </div>

                  {isGrowth && <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/30 via-primary/50 to-accent/30" />}
                </div>

                {/* Card body */}
                <div className="px-5 py-5 flex flex-col flex-1 gap-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{plan.description}</p>

                  <ul className="flex flex-col gap-2">
                    {[
                      plan.bookings,
                      `Transaction fee: ${plan.transactionFee}`,
                      plan.doctors,
                      plan.deals,
                      plan.whatsapp ? "WhatsApp notifications" : null,
                      plan.badge ? "Premium verified badge" : null,
                      plan.featured ? "Featured deal placement" : null,
                      `${plan.analytics} analytics`,
                      plan.support !== "None" ? `Support: ${plan.support}` : null,
                    ].filter(Boolean).map((feature) => (
                      <li key={feature as string} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    <Button
                      className={`w-full gap-2 group h-11 font-bold rounded-xl ${isGrowth ? "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20" : "border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"}`}
                      variant={isGrowth ? "default" : "outline"}
                      onClick={() => setLocation("/register-clinic")}
                      data-testid={`button-choose-${plan.id}`}
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="rounded-2xl border border-border/60 bg-background/80 overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-border/60 bg-secondary/30 dark:bg-secondary/20">
            <h2 className="text-lg font-bold text-foreground">Full feature comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left px-6 py-3 text-muted-foreground font-semibold w-1/2">Feature</th>
                  <th className="text-center px-4 py-3 text-foreground font-bold">Starter</th>
                  <th className="text-center px-4 py-3 text-primary font-bold">Growth</th>
                  <th className="text-center px-4 py-3 text-foreground font-bold">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={row.label} className={`border-b border-border/40 ${i % 2 === 0 ? "bg-secondary/10 dark:bg-secondary/5" : ""}`}>
                    <td className="px-6 py-3 text-muted-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-center"><Cell value={row.starter} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.growth} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No payment required to register — choose a plan when you're ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              className="gap-2 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl h-11 px-8"
              onClick={() => setLocation("/register-clinic")}
              data-testid="button-register-clinic-bottom"
            >
              Register Your Clinic
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
