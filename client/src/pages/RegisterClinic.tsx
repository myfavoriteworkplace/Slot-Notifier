import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClinicSchema, type InsertClinic } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Building2, Mail, Phone, MapPin, Hash,
  User, Lock, Info, ArrowLeft, Eye, EyeOff, Sparkles,
} from "lucide-react";
import { z } from "zod";

function FieldRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
      <div className="flex items-center justify-center h-10 w-10 shrink-0 border-r border-border/40 bg-muted/30">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

export default function RegisterClinic() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<InsertClinic>({
    resolver: zodResolver(insertClinicSchema.extend({
      username: z.string().min(3, "Username must be at least 3 characters"),
      passwordHash: z.string().min(6, "Password must be at least 6 characters"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      address: z.string().optional().or(z.literal("")),
      city: z.string().optional().or(z.literal("")),
      pincode: z.string().optional().or(z.literal("")),
    })),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      pincode: "",
      email: "",
      phone: "",
      username: "",
      passwordHash: "",
      status: "pending",
      doctors: [],
    },
  });

  async function onSubmit(data: InsertClinic) {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/clinics/register", data);
      toast({
        title: "Registration Submitted",
        description: "Your clinic registration is pending approval by the system administrator.",
      });
      setLocation("/getting-started");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong during registration.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">

      {/* Ambient glow blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-xl rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">

        {/* 3px neon top bar */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />

        {/* Gradient hero header */}
        <div className="relative bg-gradient-to-r from-primary/90 via-primary to-accent/80 px-6 pt-6 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_65%)] pointer-events-none" />

          {/* Decorative large icon in corner */}
          <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 h-32 w-32 text-white opacity-[0.06] pointer-events-none select-none" />

          {/* Back link */}
          <button
            type="button"
            onClick={() => setLocation("/getting-started")}
            className="absolute top-4 left-4 flex items-center gap-1 text-white/60 hover:text-white text-[11px] font-medium transition-colors"
            data-testid="link-back-getting-started"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>

          <div className="relative flex flex-col items-center text-center pt-4">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-white/60" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">For Clinic Owners</span>
            </div>

            {/* Icon avatar with glow */}
            <div className="relative mb-4">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 blur-lg" />
              <div className="relative h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center ring-2 ring-white/10">
                <Building2 className="h-8 w-8 text-white drop-shadow" />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
              Register Your Clinic
            </h1>
            <p className="text-sm text-white/55 max-w-sm">
              Join our network of healthcare providers. Fill in your details and we'll get you set up.
            </p>
          </div>

          {/* Bottom neon divider */}
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-accent/40 via-primary/60 to-accent/40" />
        </div>

        {/* Form body */}
        <div className="px-6 pt-6 pb-7 space-y-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* ── Section: Clinic Info ── */}
              <SectionLabel>Clinic Information</SectionLabel>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FieldRow icon={Building2}>
                        <Input
                          placeholder="City Dental Clinic"
                          {...field}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                          data-testid="input-clinic-name"
                        />
                      </FieldRow>
                    </FormControl>
                    <FormMessage className="text-xs pl-1" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Mail}>
                          <Input
                            type="email"
                            placeholder="contact@clinic.com"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-email"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Phone}>
                          <Input
                            placeholder="+91 9876543210"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-phone"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Section: Location ── */}
              <SectionLabel>Location</SectionLabel>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FieldRow icon={MapPin}>
                        <Input
                          placeholder="Street / Building"
                          {...field}
                          value={field.value || ""}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                          data-testid="input-clinic-address"
                        />
                      </FieldRow>
                    </FormControl>
                    <FormMessage className="text-xs pl-1" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={MapPin}>
                          <Input
                            placeholder="e.g. Kochi"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-city"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Hash}>
                          <Input
                            placeholder="e.g. 682001"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-pincode"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Section: Account ── */}
              <SectionLabel>Account Credentials</SectionLabel>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={User}>
                          <Input
                            placeholder="clinic_admin"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm"
                            data-testid="input-clinic-username"
                          />
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passwordHash"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FieldRow icon={Lock}>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            value={field.value || ""}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 rounded-none pl-3 text-sm flex-1"
                            data-testid="input-clinic-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </FieldRow>
                      </FormControl>
                      <FormMessage className="text-xs pl-1" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Approval info panel */}
              <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your registration will be reviewed by our admin team. Once approved, you'll receive an email with instructions to set up your clinic dashboard.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-1">
                <Button
                  type="submit"
                  className="w-full h-11 font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 shadow-md shadow-primary/20 rounded-xl"
                  disabled={isSubmitting}
                  data-testid="button-submit-registration"
                >
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                    : "Submit Registration"
                  }
                </Button>
                <button
                  type="button"
                  onClick={() => setLocation("/getting-started")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                  data-testid="button-cancel-registration"
                >
                  Cancel and go back
                </button>
              </div>

            </form>
          </Form>
        </div>

      </div>
    </div>
  );
}
