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
        <div className="border-t border-amber-200/60 dark:border-amber-800/40">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50/60 dark:bg-amber-900/20 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            data-testid="button-toggle-past-visit-notes"
          >
            <History className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex-1 text-left">
              Previous Visit Notes
              <span className="ml-1.5 font-normal normal-case tracking-normal text-amber-600/70 dark:text-amber-500/70">
                ({pastVisits.reduce((acc, v) => acc + v.notes.length, 0)} note{pastVisits.reduce((acc, v) => acc + v.notes.length, 0) !== 1 ? "s" : ""} across {pastVisits.length} visit{pastVisits.length !== 1 ? "s" : ""})
              </span>
            </span>
            {historyOpen
              ? <ChevronUp className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
              : <ChevronDown className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
            }
          </button>

          {historyOpen && (
            <div className="px-3 py-3 space-y-4 max-h-72 overflow-y-auto bg-amber-50/30 dark:bg-amber-900/10">
              {pastVisits.map((visit) => (
                <div key={visit.bookingId}>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <span className="h-px flex-1 bg-amber-200 dark:bg-amber-800/50" />
                    Visit on {format(new Date(visit.slotDate), "d MMM yyyy, h:mm a")}
                    <span className="h-px flex-1 bg-amber-200 dark:bg-amber-800/50" />
                  </p>
                  <div className="space-y-2">
                    {visit.notes.map((note) => (
                      <div
                        key={note.id}
                        className={`flex flex-col gap-0.5 ${note.authorType === authorType ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[88%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed opacity-80 ${
                            note.authorType === "doctor"
                              ? "bg-primary/8 text-foreground rounded-tl-sm"
                              : "bg-accent/8 text-foreground rounded-tr-sm"
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold mb-0.5 ${
                              note.authorType === "doctor" ? "text-primary" : "text-accent"
                            }`}
                          >
                            {note.authorName}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{note.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground/40 px-1">
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
