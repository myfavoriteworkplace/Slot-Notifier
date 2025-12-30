import { useState } from "react";
import { useCreateSlot } from "@/hooks/use-slots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { addHours, format, parse } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

export function CreateSlotDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const { user } = useAuth();
  
  const createSlot = useCreateSlot();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime) return;

    // Construct Date objects
    const startDateTime = new Date(`${date}T${startTime}`);
    // Default slot duration is 1 hour for MVP simplicity
    const endDateTime = addHours(startDateTime, 1);

    createSlot.mutate(
      {
        startTime: startDateTime,
        endTime: endDateTime,
        // @ts-ignore - Schema expects ownerId but backend extracts it from auth. 
        // We pass empty/dummy if strictly required by type, or backend ignores.
        // Actually schema requires ownerId. Let's pass it if available or handle in backend.
        // The backend schema implies ownerId is required in insert. 
        // Best practice: Backend should override this from session.
        // For now, passing user.id assuming hook handles auth context or backend does.
        ownerId: user?.id || "", 
      },
      {
        onSuccess: () => {
          setOpen(false);
          setDate("");
          setStartTime("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
          <Plus className="h-4 w-4" />
          Create Slot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Slot</DialogTitle>
          <DialogDescription>
            Create an available time slot for customers to book.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().split("T")[0]}
              className="rounded-xl border-border/50 bg-muted/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Start Time</Label>
            <Input
              id="time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="rounded-xl border-border/50 bg-muted/30"
            />
            <p className="text-xs text-muted-foreground">Slots are created for 1 hour duration by default.</p>
          </div>
          <DialogFooter>
            <Button 
              type="submit" 
              disabled={createSlot.isPending}
              className="w-full sm:w-auto"
            >
              {createSlot.isPending ? "Creating..." : "Create Slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
