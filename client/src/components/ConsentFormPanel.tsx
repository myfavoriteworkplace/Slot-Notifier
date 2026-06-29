import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Eye, Save, ChevronDown, ChevronUp, Hash, Clock, CheckCircle2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ConsentTextVersion } from "@shared/schema";

export default function ConsentFormPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [hasEdited, setHasEdited] = useState(false);

  const {
    data: current,
    isLoading: loadingCurrent,
    isError: errorCurrent,
    refetch: refetchCurrent,
  } = useQuery<ConsentTextVersion | null>({
    queryKey: ["/api/auth/clinic/consent-versions/current"],
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: versions,
    isLoading: loadingVersions,
    refetch: refetchVersions,
  } = useQuery<ConsentTextVersion[]>({
    queryKey: ["/api/auth/clinic/consent-versions"],
    enabled: showHistory,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; textEn: string }) =>
      apiRequest("POST", "/api/auth/clinic/consent-versions", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/clinic/consent-versions/current"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/clinic/consent-versions"] });
      setHasEdited(false);
      toast({ title: "Consent version saved", description: "New version is now live for all consent requests." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message || "Failed to save consent version.", variant: "destructive" });
    },
  });

  function handleLoadCurrent() {
    if (!current) return;
    setEditTitle(current.title);
    setEditText(current.textEn);
    setHasEdited(false);
  }

  function handleTextChange(val: string) {
    setEditText(val);
    setHasEdited(true);
  }

  function handleSave() {
    if (!editText.trim() || editText.trim().length < 20) {
      toast({ title: "Text too short", description: "Consent text must be at least 20 characters.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ title: editTitle.trim() || "Standard Dental Consent", textEn: editText.trim() });
  }

  const previewText = editText || current?.textEn || "";

  return (
    <div className="space-y-4">

      {/* Panel header */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="flex">
          <div className="w-1.5 bg-indigo-500/60 shrink-0" />
          <div className="flex-1 px-4 sm:px-5 py-4 bg-gradient-to-r from-indigo-500/[0.06] to-transparent flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <FileText className="h-[18px] w-[18px] text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight">Consent Form</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Edit the wording patients see before signing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current version card */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Live Version</p>
        </div>
        <div className="px-4 sm:px-5 py-3 sm:py-4">
          {loadingCurrent ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-64" />
            </div>
          ) : errorCurrent ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Failed to load version.</span>
              <Button variant="ghost" size="sm" onClick={() => refetchCurrent()} className="h-7 px-2 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            </div>
          ) : !current ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No consent version found. Write one below and save it.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 text-xs font-semibold">
                  v{current.version}
                </Badge>
                {current.isCurrent && (
                  <Badge className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-medium">{current.title}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Effective {format(new Date(current.effectiveFrom!), "dd MMM yyyy, hh:mm a")}</span>
                </div>
                {current.createdByEmail && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="h-3 w-3 shrink-0" />
                    <span className="font-mono truncate" title={current.textHash}>{current.textHash.slice(0, 16)}…</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadCurrent}
                className="h-9 min-h-[44px] text-xs border-indigo-500/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/5 active:scale-[0.98] transition-transform"
                data-testid="button-load-current-version"
              >
                Load into editor
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/40 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit Consent Text</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={!previewText}
            className="h-9 min-h-[44px] gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-preview-consent"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview patient view
          </Button>
        </div>
        <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Form Title</p>
            <Input
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); setHasEdited(true); }}
              placeholder="e.g. Standard Dental Consent"
              className="h-10 text-sm"
              onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "center" })}
              data-testid="input-consent-title"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consent Body Text</p>
            <Textarea
              value={editText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Type the full consent text patients must read and agree to before signing…"
              className="min-h-[240px] text-sm leading-relaxed resize-y font-mono"
              onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "center" })}
              data-testid="textarea-consent-text"
            />
            <p className="text-xs text-muted-foreground">
              {editText.trim().length} characters · Every save creates a new numbered version (e.g. v1.1, v1.2).
            </p>
          </div>
        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 px-4 sm:px-5 pb-[env(safe-area-inset-bottom)] py-3 bg-background/95 backdrop-blur-sm border-t border-border/40">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasEdited || editText.trim().length < 20}
            className="w-full sm:w-auto min-h-[44px] gap-2 bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] transition-transform"
            data-testid="button-save-consent-version"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveMutation.isPending ? "Saving…" : "Save as new version"}
          </Button>
        </div>
      </div>

      {/* Version history */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 min-h-[44px] hover:bg-muted/30 transition-colors"
          data-testid="button-toggle-version-history"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold">Version History</span>
          </div>
          {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showHistory && (
          <div className="border-t border-border/40">
            {loadingVersions ? (
              <div className="px-4 sm:px-5 py-4 space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : !versions || versions.length === 0 ? (
              <div className="px-4 sm:px-5 py-6 text-center">
                <p className="text-sm text-muted-foreground">No versions saved yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Version</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Title</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Saved</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">Scope</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {versions.map((v) => (
                      <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">v{v.version}</span>
                            {v.isCurrent && (
                              <Badge className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 text-[10px] px-1 py-0">
                                Live
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-foreground/80 max-w-[140px] truncate">{v.title}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {v.createdAt ? format(new Date(v.createdAt), "dd MMM yy") : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {v.clinicId ? "Clinic" : "Global default"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => {
                              setEditTitle(v.title);
                              setEditText(v.textEn);
                              setHasEdited(true);
                              setShowHistory(false);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium min-h-[44px] flex items-center justify-end"
                            data-testid={`button-load-version-${v.id}`}
                          >
                            Load
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Patient preview modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Patient Preview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg px-3 py-2">
              This is how the consent declaration will appear to patients on their signing page.
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/40 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Consent Declaration</p>
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {previewText || <span className="text-muted-foreground italic">No text entered yet.</span>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
