import { Database, FileImage, HardDrive, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
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

  const used = data?.quota.usedBytes ?? 0;
  const limit = data?.quota.limitBytes ?? 0;
  const usedPercent = Math.min(100, data?.quota.usagePercent ?? 0);
  const planLabel = data?.quota.source === "clinic_override" ? "Custom allowance" : `${data?.quota.plan || "Starter"} Plan`;

  return <div className="max-w-6xl space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Storage &amp; file usage</h2>
        <p className="text-sm text-muted-foreground">Manage this clinic&apos;s storage allowance, bucket sync, and upload limits.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="shrink-0">
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Refresh
      </Button>
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-emerald-50/40 pb-4 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide">
              <HardDrive className="h-4 w-4 text-emerald-600" />Storage allowance
            </CardTitle>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{planLabel}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight">{isLoading ? "…" : formatBytes(used)}</p>
              <p className="text-xs text-muted-foreground">of {formatBytes(limit)} used</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{isLoading ? "…" : `${Math.round(usedPercent)}%`}</p>
              <p className="text-[11px] text-muted-foreground">utilized</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label="Clinic storage usage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPercent}>
              <div className={`h-full transition-all ${usedPercent >= 90 ? "bg-red-500" : usedPercent >= 75 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>Tracked documents</span><span>{formatBytes(data?.quota.remainingBytes ?? 0)} remaining</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <div className="rounded-md bg-slate-50 p-2.5 dark:bg-slate-900/40"><p className="text-[11px] text-muted-foreground">Tracked files</p><p className="text-sm font-bold">{data?.tracked.files ?? 0}</p></div>
            <div className="rounded-md bg-slate-50 p-2.5 dark:bg-slate-900/40"><p className="text-[11px] text-muted-foreground">Remaining capacity</p><p className="text-sm font-bold">{formatBytes(data?.quota.remainingBytes ?? 0)}</p></div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">Need more space for high-resolution files?</p>
            <Button size="sm" className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700">Upgrade capacity</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><ShieldCheck className="h-4 w-4 text-emerald-600" />Bucket sync &amp; audit</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="text-xs font-semibold">R2 bucket scan</p><p className="truncate text-[11px] text-muted-foreground">{data?.exact ? `${data.exact.files} objects · ${formatBytes(data.exact.bytes)}` : data?.r2Configured ? "Refresh to scan bucket" : "R2 credentials not configured"}</p></div>
              <Button variant="outline" size="sm" className="h-7 shrink-0 px-2.5 text-[11px]" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="mr-1 h-3 w-3" />Sync</Button>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="text-xs font-semibold">Untracked clinic files</p><p className="truncate text-[11px] text-muted-foreground">{untracked ? `${untracked.count} candidate${untracked.count === 1 ? "" : "s"} · ${new Date(untracked.scannedAt).toLocaleString()}` : "Private files without matching metadata"}</p></div>
              <Button variant="outline" size="sm" className="h-7 shrink-0 px-2.5 text-[11px]" onClick={() => scanUntracked()} disabled={untrackedFetching}><Search className="mr-1 h-3 w-3" />Scan</Button>
            </div>
            {untrackedLoading && <p className="px-4 py-2 text-[11px] text-muted-foreground">Scanning clinic storage…</p>}
            {untracked && untracked.candidates.length > 0 && <div className="border-t px-4 py-3">
              <div className="max-h-40 overflow-auto rounded-md border divide-y">{untracked.candidates.map(file => <label key={file.key} className="flex cursor-pointer items-center gap-2 p-2 text-[11px] hover:bg-muted/40"><input type="checkbox" checked={selectedKeys.includes(file.key)} onChange={e => setSelectedKeys(current => e.target.checked ? [...current, file.key] : current.filter(key => key !== file.key))} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{file.key}</span><span className="text-muted-foreground">{formatBytes(file.bytes)}{file.lastModified ? ` · ${new Date(file.lastModified).toLocaleString()}` : ""}</span></span></label>)}</div>
              <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{selectedKeys.length} selected</span><Button variant="destructive" size="sm" className="h-7 text-[11px]" disabled={!selectedKeys.length || deleteUntracked.isPending} onClick={() => { if (window.confirm(`Permanently delete ${selectedKeys.length} selected file(s)? This cannot be undone.`)) deleteUntracked.mutate(selectedKeys); }}><Trash2 className="mr-1 h-3 w-3" />Delete</Button></div>
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><FileImage className="h-4 w-4 text-emerald-600" />Upload file limits</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-4">
            {[
              ["Patient documents", "10 MB"],
              ["Clinic documents", "5 MB"],
              ["Case media", "3 MB"],
              ["Supported types", "JPG, PNG, PDF"],
            ].map(([label, value]) => <div key={label} className="rounded-md border bg-slate-50 p-2.5 dark:bg-slate-900/40"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-bold">{value}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>;
}