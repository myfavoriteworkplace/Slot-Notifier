import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Activate() {
  const [, params] = useRoute("/activate/:token");
  const [, navigate] = useLocation();
  const token = params?.token;

  const [status, setStatus] = useState<"loading" | "ready" | "paying" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [activationData, setActivationData] = useState<{
    clinicName: string;
    plan: string;
    billingCycle: string;
    razorpayKeyId: string;
    razorpaySubscriptionId: string;
  } | null>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("Invalid activation link."); return; }
    apiRequest("GET", `/api/activate/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || "Invalid or expired activation link.");
        }
        return res.json();
      })
      .then((data) => {
        setActivationData(data);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus("error");
      });
  }, [token]);

  async function handlePay() {
    if (!activationData) return;
    setStatus("paying");
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setErrorMsg("Failed to load payment gateway. Please refresh and try again.");
      setStatus("error");
      return;
    }
    const options = {
      key: activationData.razorpayKeyId,
      subscription_id: activationData.razorpaySubscriptionId,
      name: "BookMySlot",
      description: `${activationData.plan} Plan — ${activationData.billingCycle}`,
      handler: () => {
        setStatus("success");
      },
      modal: {
        ondismiss: () => setStatus("ready"),
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  const planLabel = activationData
    ? `${activationData.plan.charAt(0).toUpperCase() + activationData.plan.slice(1)} — ${activationData.billingCycle === "annual" ? "Annual" : "Monthly"}`
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-xl border border-border/60">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === "success" ? "Payment successful!" : "Activate your subscription"}
          </CardTitle>
          <CardDescription>
            {status === "success"
              ? "Your clinic is now active. You can log in to your dashboard."
              : "Complete payment to activate your BookMySlot clinic account."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying your activation link…</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/clinic-login")}>
                Go to clinic login
              </Button>
            </div>
          )}

          {(status === "ready" || status === "paying") && activationData && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Clinic</span>
                  <span className="font-medium">{activationData.clinicName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{planLabel}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                You'll be charged automatically each {activationData.billingCycle === "annual" ? "year" : "month"}. Cancel anytime.
              </p>
              <Button
                className="w-full h-11 gap-2 font-semibold"
                onClick={handlePay}
                disabled={status === "paying"}
                data-testid="button-activate-pay"
              >
                {status === "paying" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Opening payment…</>
                ) : (
                  <><CreditCard className="h-4 w-4" /> Pay & Activate</>
                )}
              </Button>
            </>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Your subscription is now active. Log in to access your clinic dashboard.
              </p>
              <Button className="w-full gap-2" onClick={() => navigate("/clinic-login")} data-testid="button-go-to-login">
                Go to clinic login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
