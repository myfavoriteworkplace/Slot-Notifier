import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, AlertCircle, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const type = params.get("type") as "clinic" | "doctor" | null;

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token || !type || !["clinic", "doctor"].includes(type)) {
      setStatus("error");
      setErrorMsg("This reset link is invalid. Please request a new one.");
    }
  }, [token, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setStatus("submitting");
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token, type, newPassword });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Unable to connect. Please check your connection and try again.");
      setStatus("idle");
    }
  };

  const typeLabel = type === "doctor" ? "Doctor" : "Clinic";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-xl border border-border/60">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            {status === "success"
              ? <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              : <KeyRound className="h-7 w-7 text-primary" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === "success" ? "Password updated!" : "Set a new password"}
          </CardTitle>
          <CardDescription>
            {status === "success"
              ? "Your password has been changed. You can now log in."
              : `Enter a new password for your BookMySlot ${typeLabel} account.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Invalid link */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/clinic-login")}>
                Back to login
              </Button>
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-2">
              <p className="text-sm text-muted-foreground text-center">
                A confirmation email has been sent to your registered address. If this wasn't you, contact support immediately.
              </p>
              <Button className="w-full gap-2" onClick={() => navigate("/clinic-login")} data-testid="button-back-to-login">
                Go to login
              </Button>
            </div>
          )}

          {/* Form */}
          {(status === "idle" || status === "submitting") && token && type && (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  New Password
                </label>
                <div className="flex items-center rounded-xl border border-border/70 bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                  <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/50 bg-muted/40">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-[13.5px] flex-1"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="flex items-center rounded-xl border border-border/70 bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                  <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/50 bg-muted/40">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    autoComplete="new-password"
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-[13.5px] flex-1"
                    data-testid="input-confirm-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Strength hint */}
              <p className="text-[11px] text-muted-foreground">
                Use at least 8 characters. Mix letters, numbers, and symbols for a stronger password.
              </p>

              {/* Inline error */}
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/8 border border-destructive/20">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  <span className="text-[12.5px] text-destructive leading-snug">{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-bold text-[14px]"
                disabled={status === "submitting"}
                data-testid="button-reset-password"
              >
                {status === "submitting"
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating password…</>
                  : "Set New Password"}
              </Button>

              <button
                type="button"
                onClick={() => navigate("/clinic-login")}
                className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                ← Back to login
              </button>

            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
