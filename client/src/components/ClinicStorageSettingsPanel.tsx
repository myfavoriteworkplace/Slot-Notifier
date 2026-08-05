import { Database, HardDrive, RefreshCw, ShieldCheck, FileImage } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StorageReport = {
  tracked: { files: number; bytes: number };
  exact: { files: number; bytes: number; scannedAt: string; byPrefix: Record<string, { files: number; bytes: number }> } | null;
  r2Configured: boolean;
  quota: { usedBytes: number; limitBytes: number; remainingBytes: number; usagePercent: number; source: string; plan: string };
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`;
};

export default function ClinicStorageSettingsPanel() {
  const { data, isLoading, isFetching, refetch } = useQuery<StorageReport>({
    queryKey: ["/api/auth/clinic/settings/storage"],
    queryFn: async () => (await apiRequest("GET", "/api/auth/clinic/settings/storage")).json(),
    staleTime: 5 * 60_000,
  });
  return <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold">Settings</h2>
      <p className="text-sm text-muted-foreground">Storage usage and upload information for this clinic.</p>
    </div>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-primary" />Storage overview</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Tracked usage is based on saved file metadata. R2 usage is a bucket scan.</p></div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-muted/20 p-4"><Database className="h-5 w-5 text-primary mb-2" /><p className="text-xs text-muted-foreground">Tracked storage estimate</p><p className="text-2xl font-bold">{isLoading ? "…" : formatBytes(data?.tracked.bytes ?? 0)}</p><p className="text-xs text-muted-foreground">{data?.tracked.files ?? 0} saved file records</p></div>
        <div className="rounded-xl border bg-muted/20 p-4"><ShieldCheck className="h-5 w-5 text-emerald-600 mb-2" /><p className="text-xs text-muted-foreground">Exact R2 bucket scan</p><p className="text-2xl font-bold">{data?.exact ? formatBytes(data.exact.bytes) : "Not scanned"}</p><p className="text-xs text-muted-foreground">{data?.exact ? `${data.exact.files} objects · ${new Date(data.exact.scannedAt).toLocaleString()}` : data?.r2Configured ? "Refresh to scan" : "R2 credentials are not configured"}</p></div>
      </CardContent>
    </Card>
     <Card>
       <CardHeader><CardTitle className="text-base">Clinic storage allowance</CardTitle></CardHeader>
       <CardContent className="space-y-3">
         <div className="flex items-end justify-between gap-3"><div><p className="text-2xl font-bold">{isLoading ? "…" : formatBytes(data?.quota.usedBytes ?? 0)}</p><p className="text-xs text-muted-foreground">of {formatBytes(data?.quota.limitBytes ?? 0)} used</p></div><p className="text-lg font-semibold">{isLoading ? "…" : `${Math.round(data?.quota.usagePercent ?? 0)}%`}</p></div>
         <div className="h-3 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Clinic storage usage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, data?.quota.usagePercent ?? 0)}><div className={`h-full transition-all ${(data?.quota.usagePercent ?? 0) >= 90 ? "bg-destructive" : (data?.quota.usagePercent ?? 0) >= 75 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(100, data?.quota.usagePercent ?? 0)}%` }} /></div>
         <div className="flex justify-between text-xs text-muted-foreground"><span>{formatBytes(data?.quota.remainingBytes ?? 0)} remaining</span><span>{data?.quota.source === "clinic_override" ? "Custom clinic allowance" : `${data?.quota.plan || "Starter"} plan allowance`}</span></div>
       </CardContent>
     </Card>
    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><FileImage className="h-4 w-4" />Current upload limits</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 text-sm"><div>Patient documents <strong className="float-right">10 MB</strong></div><div>Clinic documents <strong className="float-right">5 MB</strong></div><div>Case media <strong className="float-right">3 MB</strong></div><div>Images and PDFs only for patient documents</div></CardContent></Card>
  </div>;
}