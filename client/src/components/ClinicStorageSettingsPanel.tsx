import { Database, HardDrive, RefreshCw, ShieldCheck, FileImage, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StorageReport = {
  tracked: { files: number; bytes: number };
  exact: { files: number; bytes: number; scannedAt: string; byPrefix: Record<string, { files: number; bytes: number }> } | null;
  r2Configured: boolean;
  quota: { usedBytes: number; limitBytes: number; remainingBytes: number; usagePercent: number; source: string; plan: string };
};
type UntrackedReport = { candidates: { key: string; bytes: number; lastModified: string | null }[]; scannedAt: string; count: number };

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
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const { data: untracked, isLoading: untrackedLoading, isFetching: untrackedFetching, refetch: scanUntracked } = useQuery<UntrackedReport>({
    queryKey: ["/api/auth/clinic/settings/storage/untracked"],
    queryFn: async () => (await apiRequest("GET", "/api/auth/clinic/settings/storage/untracked")).json(),
    enabled: false,
  });
  const deleteUntracked = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await apiRequest("POST", "/api/auth/clinic/settings/storage/untracked/delete", { keys });
      if (!response.ok) throw new Error((await response.json()).message || "Unable to delete files");
      return response.json();
    },
    onSuccess: () => { setSelectedKeys([]); scanUntracked(); refetch(); },
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
     <Card>
       <CardHeader className="flex flex-row items-center justify-between gap-3">
         <div><CardTitle className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" />Untracked clinic files</CardTitle><p className="text-xs text-muted-foreground mt-1">Reviews only private files under this clinic's namespace. Nothing is deleted during a scan.</p></div>
         <Button variant="outline" size="sm" onClick={() => scanUntracked()} disabled={untrackedFetching}><Search className="h-3.5 w-3.5 mr-1.5" />Scan</Button>
       </CardHeader>
       <CardContent className="space-y-3">
         {!untracked && !untrackedLoading && <p className="text-xs text-muted-foreground">Run a scan to look for files without matching clinic document metadata.</p>}
         {untrackedLoading && <p className="text-xs text-muted-foreground">Scanning clinic storage…</p>}
         {untracked && <><p className="text-xs text-muted-foreground">{untracked.count} candidate{untracked.count === 1 ? "" : "s"} found · scanned {new Date(untracked.scannedAt).toLocaleString()}</p>
           {untracked.candidates.length > 0 && <div className="max-h-64 overflow-auto rounded-md border divide-y">{untracked.candidates.map(file => <label key={file.key} className="flex items-center gap-3 p-2.5 text-xs cursor-pointer hover:bg-muted/40"><input type="checkbox" checked={selectedKeys.includes(file.key)} onChange={e => setSelectedKeys(current => e.target.checked ? [...current, file.key] : current.filter(key => key !== file.key))} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{file.key}</span><span className="text-muted-foreground">{formatBytes(file.bytes)}{file.lastModified ? ` · ${new Date(file.lastModified).toLocaleString()}` : ""}</span></span></label>)}</div>}
           {untracked.candidates.length > 0 && <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{selectedKeys.length} selected. Re-scan before deleting if the list is old.</p><Button variant="destructive" size="sm" disabled={!selectedKeys.length || deleteUntracked.isPending} onClick={() => { if (window.confirm(`Permanently delete ${selectedKeys.length} selected file(s)? This cannot be undone.`)) deleteUntracked.mutate(selectedKeys); }}><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete selected</Button></div>}
         </>}
       </CardContent>
     </Card>
    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><FileImage className="h-4 w-4" />Current upload limits</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 text-sm"><div>Patient documents <strong className="float-right">10 MB</strong></div><div>Clinic documents <strong className="float-right">5 MB</strong></div><div>Case media <strong className="float-right">3 MB</strong></div><div>Images and PDFs only for patient documents</div></CardContent></Card>
  </div>;
}