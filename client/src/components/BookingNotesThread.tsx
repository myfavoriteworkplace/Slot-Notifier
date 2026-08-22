import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Send, MessageSquare, Loader2, History, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface BookingNote {
  id: number;
  bookingId: number;
  authorType: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface PastVisitNotes {
  bookingId: number;
  slotDate: string;
  notes: BookingNote[];
}

interface BookingNotesThreadProps {
  bookingId: number;
  authorType: "doctor" | "clinic_admin";
}

export function BookingNotesThread({ bookingId, authorType }: BookingNotesThreadProps) {
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: notes = [], isLoading } = useQuery<BookingNote[]>({
    queryKey: ["/api/booking", bookingId, "notes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/booking/${bookingId}/notes`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
  });

  const { data: pastVisits = [], isLoading: pastLoading } = useQuery<PastVisitNotes[]>({
    queryKey: ["/api/booking", bookingId, "notes/history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/booking/${bookingId}/notes/history`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/booking/${bookingId}/notes`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/booking", bookingId, "notes"] });
      setInput("");
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  return (
    <div className="rounded-xl border border-green-800/30 bg-white dark:bg-card shadow-sm overflow-hidden flex flex-col gap-0">

      {/* Current visit thread */}
      <div className="flex flex-col">
        <div className="px-3 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-800/30 dark:border-green-700/50 flex items-center gap-1.5 shrink-0">
          <MessageSquare className="h-3 w-3 text-green-800 dark:text-green-300" />
          <span className="text-xs font-bold uppercase tracking-wider text-green-800 dark:text-green-300">
            Notes &amp; Messages
          </span>
        </div>

        <div ref={scrollRef} className="max-h-52 overflow-y-auto px-3 py-2.5 space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground/60 text-center py-3">Loading...</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-3">
              No notes yet. Add the first one below.
            </p>
          ) : (
            notes.map((note) => {
              const isMine = note.authorType === authorType;
              return (
                <div
                  key={note.id}
                  className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${
                      note.authorType === "doctor"
                        ? "bg-primary/10 text-foreground rounded-tl-sm"
                        : "bg-accent/10 text-foreground rounded-tr-sm"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold mb-0.5 ${
                        note.authorType === "doctor"
                          ? "text-primary"
                          : "text-accent"
                      }`}
                    >
                      {note.authorName}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{note.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground/50 px-1">
                    {format(new Date(note.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-border/50 flex gap-2 items-end shrink-0">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a note… (Shift+Enter for new line)"
            className="resize-none text-xs min-h-[2.25rem] h-9 flex-1 py-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-testid={`input-booking-note-${bookingId}`}
          />
          <Button
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            data-testid={`button-send-note-${bookingId}`}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Previous visit notes — read-only, collapsible */}
      {!pastLoading && pastVisits.length > 0 && (
        <div className="border-t border-slate-300 dark:border-slate-600">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors min-h-[44px]"
            data-testid="button-toggle-past-visit-notes"
          >
            <History className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex-1 text-left">
              Previous Visit Notes
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">
                ({pastVisits.reduce((acc, v) => acc + v.notes.length, 0)} note{pastVisits.reduce((acc, v) => acc + v.notes.length, 0) !== 1 ? "s" : ""} across {pastVisits.length} visit{pastVisits.length !== 1 ? "s" : ""})
              </span>
            </span>
            {historyOpen
              ? <ChevronUp className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            }
          </button>

          {historyOpen && (
            <div className="border-t border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-900/20 px-0 py-3 space-y-4">
              {pastVisits.map((visit) => (
                <div key={visit.bookingId} className="mx-3 rounded-md border border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/30 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      Visit — {format(new Date(visit.slotDate), "d MMM yyyy, h:mm a")}
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </p>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {visit.notes.map((note) => (
                      <div key={note.id} className="px-3 py-2.5 flex items-start gap-3 bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{note.authorName}</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words mt-0.5">{note.content}</p>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                          {format(new Date(note.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
