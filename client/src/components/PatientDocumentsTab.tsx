import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Image as ImageIcon, Loader2, Upload, ExternalLink } from "lucide-react";
import type { ClinicalRecord } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["X-ray", "Clinical photograph", "Scan / Imaging", "Lab report", "Referral / Prescription", "Medical clearance", "Other"];
type Props = { bookingId: number; patientName?: string | null; doctorName?: string | null; visitDate?: string | null; authorRole: "doctor" | "clinic_admin" };

export default function PatientDocumentsTab({ bookingId, patientName, doctorName, visitDate, authorRole }: Props) {
  const qc = useQueryClient(); const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("X-ray"); const [description, setDescription] = useState(""); const [linkedRecordId, setLinkedRecordId] = useState("none");
  const { data: currentRecords = [] } = useQuery<ClinicalRecord[]>({ queryKey: ["/api/clinical-records/booking", bookingId], queryFn: async () => (await apiRequest("GET", `/api/clinical-records/booking/${bookingId}`)).json() });
  const { data: pastVisits = [] } = useQuery<{ bookingId: number; slotDate: string; records: ClinicalRecord[] }[]>({ queryKey: ["/api/clinical-records/booking", bookingId, "patient-history"], queryFn: async () => (await apiRequest("GET", `/api/clinical-records/booking/${bookingId}/patient-history`)).json() });
  const recordOptions = [{ bookingId, date: visitDate, records: currentRecords, current: true }, ...pastVisits.map(v => ({ ...v, date: v.slotDate, current: false }))].flatMap(v => v.records.filter(r => (r.diagnosis?.length ?? 0) > 0).map(r => ({ ...r, visitDate: v.date, current: v.current })));
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/patient-documents", bookingId], queryFn: async () => {
    const r = await apiRequest("GET", `/api/patient-documents/booking/${bookingId}`); return r.json();
  }});
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const signed = await (await apiRequest("POST", "/api/uploads/signed-url", { fileName: file.name, contentType: file.type, fileType: file.type, fileSize: file.size, folder: "patient-docs" })).json();
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
      <div className="flex items-center justify-between gap-2 mb-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Current Visit Documents</p>
          <p className="text-[11px] text-muted-foreground">{patientName || "Patient"} · {visitDate ? format(new Date(visitDate), "d MMM yyyy, h:mm a") : "Current visit"}{doctorName ? ` · Dr. ${doctorName}` : ""}</p></div>
        <Upload className="h-4 w-4 text-slate-500" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-2 items-center">
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
        <Select value={linkedRecordId} onValueChange={setLinkedRecordId}><SelectTrigger className="h-8 text-xs sm:col-span-2"><SelectValue placeholder="Link to diagnosis (optional)" /></SelectTrigger><SelectContent><SelectItem value="none" className="text-xs">No specific diagnosis</SelectItem>{recordOptions.map(r => <SelectItem key={r.id} value={String(r.id)} className="text-xs">{r.current ? "Current visit" : "Previous visit"} · {r.visitDate ? format(new Date(r.visitDate), "d MMM yyyy") : ""} · {(r.diagnosis ?? []).join(", ")}{r.affectedTeeth?.length ? ` · Teeth ${r.affectedTeeth.join(", ")}` : ""}</SelectItem>)}</SelectContent></Select>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="text-xs max-w-full sm:col-span-2" onChange={e => e.target.files?.[0] && upload.mutate(e.target.files[0])} disabled={upload.isPending} />
      </div>
    </div>
    <div className="rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
      <div className="px-3 py-2 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">Uploaded for this visit</div>
      {isLoading || upload.isPending ? <div className="p-4 text-xs text-muted-foreground flex gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading/loading…</div> : !data?.length ? <p className="p-4 text-xs text-muted-foreground text-center">No documents attached to this visit yet.</p> :
        <div className="divide-y divide-slate-200 dark:divide-slate-700">{data.map((doc: any) => <div key={doc.url} className="px-3 py-2.5 flex items-center gap-2"><span className="h-7 w-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">{doc.type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5 text-slate-500" /> : <FileText className="h-3.5 w-3.5 text-slate-500" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{doc.name}</p><p className="text-[11px] text-muted-foreground">{doc.category || "Document"} · {doc.uploadedByRole === "doctor" ? "Doctor" : "Clinic"}{doc.description ? ` · ${doc.description}` : ""}</p>{doc.diagnosisSnapshot?.length ? <p className="text-[11px] text-slate-500 truncate">Linked diagnosis: {doc.diagnosisSnapshot.join(", ")}{doc.affectedTeethSnapshot?.length ? ` · Teeth ${doc.affectedTeethSnapshot.join(", ")}` : ""}</p> : null}</div><Button variant="ghost" size="icon" className="h-7 w-7" asChild><a href={doc.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button></div>)}</div>}
    </div>
  </div>;
}