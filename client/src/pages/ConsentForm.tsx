import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import SignaturePad from "signature_pad";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Pen, RotateCcw, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/queryClient";

interface ConsentData {
  patientName: string;
  patientPhone: string;
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  appointmentTime?: string | null;
  status: string;
  expiresAt: string;
}

export default function ConsentForm() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [signed, setSigned] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const { data, isLoading, error } = useQuery<ConsentData>({
    queryKey: [`/api/consent/${token}`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/consent/${token}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to load consent form");
      }
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    const sp = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "#0F9B6E",
    });
    sp.addEventListener("endStroke", () => setIsEmpty(sp.isEmpty()));
    sigPadRef.current = sp;
    return () => sp.off();
  }, [data]);

  const signMutation = useMutation({
    mutationFn: async (signature: string) => {
      const res = await fetch(`${API_BASE_URL}/api/consent/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => setSigned(true),
    onError: (err: any) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const handleClear = () => {
    sigPadRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSubmit = () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast({ title: "Signature required", description: "Please sign before submitting.", variant: "destructive" });
      return;
    }
    const dataUrl = sigPadRef.current.toDataURL("image/png");
    signMutation.mutate(dataUrl);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F6]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    const msg = (error as Error)?.message || "Invalid link";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F6] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Link Unavailable</h2>
          <p className="text-muted-foreground text-sm">{msg}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F6] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Consent Signed!</h2>
          <p className="text-muted-foreground text-sm">
            Thank you, <strong>{data.patientName}</strong>. Your consent for the appointment at{" "}
            <strong>{data.clinicName}</strong> has been recorded.
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-2">You may close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F6] flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-lg space-y-5">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#085041] to-[#0F9B6E] rounded-2xl p-6 text-white shadow-lg">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">BookMySlot · Digital Consent</p>
          <h1 className="text-2xl font-extrabold">{data.clinicName}</h1>
          {data.clinicAddress && (
            <p className="text-sm text-white/70 mt-1">{data.clinicAddress}</p>
          )}
          {data.clinicPhone && (
            <p className="text-sm text-white/70">{data.clinicPhone}</p>
          )}
        </div>

        {/* Appointment Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-border/40 p-5 space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Appointment Details</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Patient</span>
              <span className="text-sm font-semibold">{data.patientName}</span>
            </div>
            {data.appointmentTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="text-sm font-semibold">
                  {format(new Date(data.appointmentTime), "dd MMM yyyy, hh:mm a")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Clinic</span>
              <span className="text-sm font-semibold">{data.clinicName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Link expires: {format(new Date(data.expiresAt), "dd MMM yyyy, hh:mm a")}</span>
          </div>
        </div>

        {/* Consent Text */}
        <div className="bg-white rounded-2xl shadow-sm border border-border/40 p-5 space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Consent Declaration</h2>
          <div className="text-sm text-foreground/80 leading-relaxed space-y-2">
            <p>
              I, <strong>{data.patientName}</strong>, hereby give my informed consent to{" "}
              <strong>{data.clinicName}</strong> to perform dental examination and any necessary
              dental treatment deemed appropriate by the treating dentist.
            </p>
            <p>
              I understand and acknowledge the following:
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground/70 pl-1">
              <li>The nature of the proposed treatment and its alternatives have been explained to me.</li>
              <li>All dental procedures carry certain risks including pain, swelling, and infection.</li>
              <li>I am responsible for informing the clinic of any allergies or medical conditions.</li>
              <li>My personal and health information will be kept confidential.</li>
              <li>I have the right to withdraw consent at any time before treatment begins.</li>
            </ul>
            <p className="text-foreground/80">
              By signing below, I confirm that I have read and understood the above and voluntarily
              consent to the dental care at <strong>{data.clinicName}</strong>.
            </p>
          </div>
        </div>

        {/* Signature Pad */}
        <div className="bg-white rounded-2xl shadow-sm border border-border/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pen className="h-4 w-4 text-primary" />
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Patient Signature</h2>
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-clear-signature"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          </div>
          <div className="relative rounded-xl border-2 border-dashed border-border overflow-hidden bg-white" style={{ height: "180px" }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none"
              style={{ display: "block" }}
              data-testid="canvas-signature"
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground/40 text-sm select-none">Sign here using your finger or mouse</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Signed digitally on {format(new Date(), "dd MMMM yyyy")} · IP address will be recorded for audit purposes.
          </p>
        </div>

        {/* Submit */}
        <Button
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-[#085041] to-[#0F9B6E] hover:from-[#085041]/90 hover:to-[#0F9B6E]/90 border-0 rounded-2xl shadow-lg"
          onClick={handleSubmit}
          disabled={signMutation.isPending || isEmpty}
          data-testid="button-submit-consent"
        >
          {signMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 mr-2" />Submit Signed Consent</>
          )}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground pb-6">
          Powered by <strong>BookMySlot</strong> · Secure digital consent
        </p>
      </div>
    </div>
  );
}
