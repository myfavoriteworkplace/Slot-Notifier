import { type Slot } from "@shared/schema";
import { format, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Trash2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteSlot } from "@/hooks/use-slots";
import { useCreateBooking } from "@/hooks/use-bookings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SlotCardProps {
  slot: Slot;
  customerName?: string;
  customerPhone?: string;
}

export function SlotCard({ slot, customerName, customerPhone }: SlotCardProps) {
  const { user } = useAuth();
  const deleteSlot = useDeleteSlot();
  const createBooking = useCreateBooking();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  
  const startTime = new Date(slot.startTime);
  const endTime = new Date(slot.endTime);
  const isOwner = user?.role === "owner";
  const isExpired = isPast(startTime);

  // Styling logic based on state
  const isBookable = !slot.isBooked && !isExpired && !isOwner;
  const statusColor = slot.isBooked 
    ? "bg-accent/10 text-accent border-accent/20" 
    : isExpired 
      ? "bg-muted text-muted-foreground border-border" 
      : "bg-green-500/10 text-green-600 border-green-500/20";

  const handleBook = () => {
    const finalName = customerName || localName;
    const finalPhone = customerPhone || localPhone;

    if (!finalName || !finalPhone) return;
    createBooking.mutate({
      slotId: slot.id,
      customerName: finalName,
      customerPhone: finalPhone,
    }, {
      onSuccess: () => {
        setIsBookingOpen(false);
        setLocalName("");
        setLocalPhone("");
      }
    });
  };

  const onSlotClick = () => {
    if (!isBookable) return;
    
    // If name/phone already provided via props, book immediately
    if (customerName && customerPhone) {
      handleBook();
    } else {
      setIsBookingOpen(true);
    }
  };

  return (
    <>
      <div 
        onClick={onSlotClick}
        className={`
          relative group overflow-hidden rounded-2xl border p-5 transition-all duration-300 cursor-pointer
          hover:shadow-lg hover:-translate-y-1
          ${slot.isBooked ? 'bg-muted/30 border-border/50' : 'bg-card border-border'}
          ${!isBookable && 'cursor-default'}
        `}
      >
        <div className="flex justify-between items-start mb-4">
          <Badge variant="outline" className={`rounded-md px-2 py-1 ${statusColor}`}>
            {slot.isBooked ? "Booked" : isExpired ? "Expired" : "Available"}
          </Badge>
          
          {isOwner && !slot.isBooked && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-destructive -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Slot</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove this time slot? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteSlot.mutate(slot.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-foreground/80">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {format(startTime, "EEEE, MMMM do")}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
            </span>
          </div>
        </div>

        <div className="mt-6">
          {isBookable ? (
            <Button 
              className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-none hover:shadow-lg transition-all"
              onClick={() => setIsBookingOpen(true)}
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Booking..." : "Book Now"}
            </Button>
          ) : slot.isBooked ? (
            <div className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-accent">
              <CheckCircle2 className="h-4 w-4" />
              <span>Reserved</span>
            </div>
          ) : isOwner ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              {slot.isBooked ? "Customer booked" : "Waiting for booking"}
            </div>
          ) : (
            <Button variant="secondary" disabled className="w-full opacity-50">
              Unavailable
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Please enter your details to complete the booking for {format(startTime, "MMM do, h:mm a")}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="col-span-3"
                placeholder="John Doe"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                className="col-span-3"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleBook} 
              disabled={createBooking.isPending || !localName || !localPhone}
            >
              {createBooking.isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
