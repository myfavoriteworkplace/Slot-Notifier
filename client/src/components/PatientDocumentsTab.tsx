import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Image as ImageIcon, Loader2, Upload, ExternalLink, Eye, Download, Trash2, CloudUpload } from "lucide-react";
import type { ClinicalRecord } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CATEGORIES = ["X-ray", "Clinical photograph", "Scan / Imaging", "Lab report", "Referral / Prescription", "Medical clearance", "Other"];
type Props = { bookingId: number; patientName?: string | null; doctorName?: string | null; visitDate?: string | null; authorRole: "doctor" | "clinic_admin" };

export default function PatientDocumentsTab({ bookingId, patientName, doctorName, visitDate, authorRole }: Props) {
  const qc = useQueryClient(); const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [category, setCategory] = useState("X-ray"); const [description, setDescription] = useState(""); const [linkedRecordId, setLinkedRecordId] = useState("none");
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/patient-documents/booking/${bookingId}`, { id });
      if (!r.ok) throw new Error((await r.json()).message || "Could not delete document");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/patient-documents", bookingId] }); notify.success("Document deleted"); },
    onError: (e: any) => notify.apiError(e, "Delete failed"),
  });
  const selectFiles = (files: FileList | File[]) => {
    const file = files[0];
    if (file) upload.mutate(file);
  };
  const { data: currentRecords = [] } = useQuery<ClinicalRecord[]>({ queryKey: ["/api/clinical-records/booking", bookingId], queryFn: async () => (await apiRequest("GET", `/api/clinical-records/booking/${bookingId}`)).json() });
  const { data: pastVisits = [] } = useQuery<{ bookingId: number; slotDate: string; records: ClinicalRecord[] }[]>({ queryKey: ["/api/clinical-records/booking", bookingId, "patient-history"], queryFn: async () => (await apiRequest("GET", `/api/clinical-records/booking/${bookingId}/patient-history`)).json() });
  const recordOptions = [{ bookingId, date: visitDate, records: currentRecords, current: true }, ...pastVisits.map(v => ({ ...v, date: v.slotDate, current: false }))].flatMap(v => v.records.filter(r => (r.diagnosis?.length ?? 0) > 0).map(r => ({ ...r, visitDate: v.date, current: v.current })));
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/patient-documents", bookingId], queryFn: async () => {
    const r = await apiRequest("GET", `/api/patient-documents/booking/${bookingId}`); return r.json();
  }});
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const signed = await (await apiRequest("POST", "/api/patient-documents/upload-url", { bookingId, fileName: file.name, contentType: file.type, fileSize: file.size })).json();
      const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("File upload failed");
      const linked = recordOptions.find(r => String(r.id) === linkedRecordId);
      const r = await apiRequest("POST", `/api/patient-documents/booking/${bookingId}`, { ...signed, name: file.name, type: file.type, size: file.size, category, description, doctorName, visitDate, uploadedByRole: authorRole, clinicalRecordId: linked?.id ?? null, diagnosisSnapshot: linked?.diagnosis ?? [], affectedTeethSnapshot: linked?.affectedTeeth ?? [] });
      if (!r.ok) throw new Error((await r.json()).message || "Could not save document");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/patient-documents", bookingId] }); setDescription(""); setLinkedRecordId("none"); if (fileRef.current) fileRef.current.value = ""; notify.success("Document uploaded"); },
    onError: (e: any) => notify.apiError(e, "Upload failed"),
  });
  return <div className="p-3.5 space-y-3">
    <div className="rounded-md border border-slate-300 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-900/20 p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Upload Visit Documents</p>
          <p className="text-[11px] text-muted-foreground">{patientName || "Patient"} · {visitDate ? format(new Date(visitDate), "d MMM yyyy, h:mm a") : "Current visit"}{doctorName ? ` · Dr. ${doctorName}` : ""}</p></div>
        <Upload className="h-4 w-4 text-slate-500" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
        <Select value={linkedRecordId} onValueChange={setLinkedRecordId}><SelectTrigger className="h-8 text-xs sm:col-span-2"><SelectValue placeholder="Link to diagnosis (optional)" /></SelectTrigger><SelectContent><SelectItem value="none" className="text-xs">No specific diagnosis</SelectItem>{recordOptions.map(r => <SelectItem key={r.id} value={String(r.id)} className="text-xs">{r.current ? "Current visit" : "Previous visit"} · {r.visitDate ? format(new Date(r.visitDate), "d MMM yyyy") : ""} · {(r.diagnosis ?? []).join(", ")}{r.affectedTeeth?.length ? ` · Teeth ${r.affectedTeeth.join(", ")}` : ""}</SelectItem>)}</SelectContent></Select>
        <div
          className={`sm:col-span-2 rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer ${isDragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-600 dark:bg-slate-900/20 dark:hover:bg-emerald-950/20"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); selectFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        >
          {upload.isPending ? <Loader2 className="h-6 w-6 mx-auto mb-1 text-emerald-600 animate-spin" /> : <CloudUpload className="h-6 w-6 mx-auto mb-1 text-emerald-600" />}
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{upload.isPending ? "Uploading document…" : "Drag & drop files here or click to browse"}</p>
          <Button type="button" size="sm" className="mt-2 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} disabled={upload.isPending}>Browse Files</Button>
          <p className="text-[11px] text-muted-foreground mt-1">Supports JPG, PNG, WebP and PDF up to 10MB</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => selectFiles(e.target.files || [])} disabled={upload.isPending} />
        </div>
      </div>
    </div>
    <div className="rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
      <div className="px-3 py-2 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Uploaded Documents</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{data?.length ?? 0} {data?.length === 1 ? "file" : "files"}</span></div>
      {isLoading || upload.isPending ? <div className="p-4 text-xs text-muted-foreground flex gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading/loading…</div> : !data?.length ? <p className="p-4 text-xs text-muted-foreground text-center">No documents attached to this visit yet.</p> :
        <div className="divide-y divide-slate-200 dark:divide-slate-700">{data.map((doc: any) => <div key={doc.id ?? doc.url} className="px-3 py-2.5 flex items-center gap-2">
          <button type="button" onClick={() => setPreviewDoc(doc)} className="h-9 w-9 rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Preview ${doc.name}`}>
            {doc.type?.startsWith("image/") ? <img src={doc.url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <FileText className="h-3.5 w-3.5 text-slate-500" />}
          </button>
          <button type="button" onClick={() => setPreviewDoc(doc)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
            <p className="text-xs font-semibold truncate">{doc.name}</p><div className="flex flex-wrap gap-1 mt-1"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{doc.category || "Document"}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{doc.uploadedByRole === "doctor" ? "Doctor" : "Clinic"}</span>{doc.uploadedAt && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{format(new Date(doc.uploadedAt), "d MMM yyyy")}</span>}</div>{doc.description && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{doc.description}</p>}{doc.diagnosisSnapshot?.length ? <p className="text-[11px] text-slate-500 truncate">Linked: {doc.diagnosisSnapshot.join(", ")}{doc.affectedTeethSnapshot?.length ? ` · Teeth ${doc.affectedTeethSnapshot.join(", ")}` : ""}</p> : null}
          </button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setPreviewDoc(doc)} aria-label={`Preview ${doc.name}`}><Eye className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild><a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Open ${doc.name}`}><ExternalLink className="h-3.5 w-3.5" /></a></Button>
           <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => { if (window.confirm(`Delete "${doc.name}"?`)) deleteMutation.mutate(doc.id); }} disabled={deleteMutation.isPending} aria-label={`Delete ${doc.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>)}</div>}
    </div>
    <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="text-sm truncate pr-6">{previewDoc?.name}</DialogTitle></DialogHeader>
        {previewDoc && <div className="space-y-3">
          <div className="min-h-[220px] max-h-[65vh] rounded-md bg-slate-950/95 flex items-center justify-center overflow-hidden">
            {previewDoc.type?.startsWith("image/") ? <img src={previewDoc.url} alt={previewDoc.name} className="max-h-[65vh] max-w-full object-contain" /> :
              previewDoc.type === "application/pdf" ? <iframe src={previewDoc.url} title={previewDoc.name} className="h-[65vh] w-full bg-white" /> :
              <p className="text-xs text-slate-300">Preview unavailable for this file type.</p>}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>{previewDoc.category || "Document"} · {previewDoc.uploadedByRole === "doctor" ? "Doctor" : "Clinic"}{previewDoc.description ? ` · ${previewDoc.description}` : ""}</p>
            {previewDoc.diagnosisSnapshot?.length ? <p>Linked diagnosis: {previewDoc.diagnosisSnapshot.join(", ")}{previewDoc.affectedTeethSnapshot?.length ? ` · Teeth ${previewDoc.affectedTeethSnapshot.join(", ")}` : ""}</p> : null}
            <a href={previewDoc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">Open original <ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}