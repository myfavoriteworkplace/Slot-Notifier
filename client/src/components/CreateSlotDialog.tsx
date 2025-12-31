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
import { addHours, format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Calendar } from "@/components/ui/calendar";

interface CreateSlotDialogProps {
  onDateSelect?: (date: Date | undefined) => void;
}

export function CreateSlotDialog({ onDateSelect }: CreateSlotDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const { user } = useAuth();
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  
  const createSlot = useCreateSlot();

  const handleQuickAdd = (selectedDate: Date | undefined) => {
    setCalendarDate(selectedDate);
    if (onDateSelect && selectedDate) {
      onDateSelect(selectedDate);
      setOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime) return;

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = addHours(startDateTime, 1);

    createSlot.mutate(
      {
        startTime: startDateTime,
        endTime: endDateTime,
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
          <DialogTitle>Add Availability</DialogTitle>
          <DialogDescription>
            Create a single slot or select a date for 3 automatic slots (9AM, 1PM, 5PM).
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Option 1: Quick Add 3 Slots</Label>
            <div className="flex justify-center p-2 border rounded-xl bg-muted/20">
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={handleQuickAdd}
                className="rounded-md"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Label className="text-sm font-semibold">Option 2: Custom Single Slot</Label>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required={!open}
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
                required={!open}
                className="rounded-xl border-border/50 bg-muted/30"
              />
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={createSlot.isPending}
                className="w-full"
              >
                {createSlot.isPending ? "Creating..." : "Create Single Slot"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
