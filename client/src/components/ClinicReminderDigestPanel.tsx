import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2, Mail, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ReminderBooking = {
  bookingId: number;
  customerName: string;
  startTime: string;
  visitType?: string | null;
  treatmentCategory?: string | null;
  assignedDoctor?: string | null;
  localDate: string;
  dateGroup: "nextThreeDays" | "comingWeek";
};

type DigestRecipient = {
  email: string;
  reminders: { nextThreeDays: ReminderBooking[]; comingWeek: ReminderBooking[]; totalCount: number };
};

type DigestPreview = { recipients: DigestRecipient[] };
type DigestSendResult = { dryRun: boolean; sent: number; failed: number; recipients: DigestRecipient[] };

const formatBooking = (booking: ReminderBooking) => `${booking.localDate} · ${new Date(booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

export default function ClinicReminderDigestPanel() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data, isFetching, refetch } = useQuery<DigestPreview>({
    queryKey: ["/api/auth/clinic/reminders/digest-preview"],
    queryFn: async () => (await apiRequest("GET", "/api/auth/clinic/reminders/digest-preview")).json(),
    enabled: false,
  });
  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/clinic/reminders/digest/send", {});
      if (!response.ok) throw new Error((await response.json()).message || "Unable to send reminder digest");
      return response.json() as Promise<DigestSendResult>;
    },
    onSuccess: result => {
      setConfirmOpen(false);
      setPreviewOpen(false);
      setMessage(result.dryRun ? "Preview completed without sending email." : `Digest sent to ${result.sent} doctor${result.sent === 1 ? "" : "s"}.`);
    },
    onError: error => setMessage(error instanceof Error ? error.message : "Unable to send reminder digest"),
  });

  const openPreview = async () => {
    setMessage(null);
    setPreviewOpen(true);
    await refetch();
  };
  const recipients = data?.recipients ?? [];
  const bookingGroups = (recipient: DigestRecipient) => [
    ...recipient.reminders.nextThreeDays,
    ...recipient.reminders.comingWeek,
  ];

  return <>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide"><CalendarClock className="h-4 w-4 text-emerald-600" />Doctor reminder digest</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Preview and send the upcoming appointment digest to doctors associated with this clinic.</p>
        <Button onClick={openPreview} disabled={isFetching} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Preview digest
        </Button>
        {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}
      </CardContent>
    </Card>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reminder digest preview</DialogTitle>
          <DialogDescription>This digest will be sent only to doctors associated with this clinic. Manual sends can be repeated at any time.</DialogDescription>
        </DialogHeader>
        {isFetching && <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>}
        {!isFetching && recipients.length === 0 && <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">No doctors are associated with this clinic.</p>}
        {!isFetching && recipients.length > 0 && <div className="space-y-3">
          {recipients.map(recipient => <div key={recipient.email} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-emerald-600" /><span className="truncate text-sm font-semibold">{recipient.email}</span></div><span className="text-xs text-muted-foreground">{recipient.reminders.totalCount} appointment{recipient.reminders.totalCount === 1 ? "" : "s"}</span></div>
            {bookingGroups(recipient).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No upcoming appointments in the next seven days.</p> : <div className="mt-3 space-y-2">{bookingGroups(recipient).map(booking => <div key={booking.bookingId} className="rounded-md bg-muted/40 px-3 py-2 text-sm"><p className="font-medium">{booking.customerName}</p><p className="text-xs text-muted-foreground">{formatBooking(booking)}{booking.assignedDoctor ? ` · ${booking.assignedDoctor}` : ""}</p>{(booking.visitType || booking.treatmentCategory) && <p className="text-xs text-muted-foreground">{[booking.visitType, booking.treatmentCategory].filter(Boolean).join(" · ")}</p>}</div>)}</div>}
          </div>)}
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button><Button onClick={() => setConfirmOpen(true)} disabled={isFetching || recipients.length === 0 || sendMutation.isPending} className="bg-emerald-600 text-white hover:bg-emerald-700"><Send className="mr-2 h-4 w-4" />Send to doctors</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Send reminder digest now?</AlertDialogTitle><AlertDialogDescription>This will send the previewed digest to {recipients.length} associated doctor{recipients.length === 1 ? "" : "s"}. The server will recalculate the data before sending.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={sendMutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={sendMutation.isPending} onClick={event => { event.preventDefault(); sendMutation.mutate(); }}>{sendMutation.isPending ? "Sending..." : "Confirm send"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
