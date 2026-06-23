import { format } from "date-fns";
import {
  Stethoscope, Trash2, GraduationCap, UserPlus, KeyRound, CalendarOff,
  Loader2, Mail, MoreHorizontal, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SpecializationInput } from "@/components/SpecializationInput";
import { ImageUpload } from "@/components/ImageUpload";

type DoctorLeave = { doctorEmail: string; leaveDate: string; reason?: string | null };
type DoctorEntry = { name: string; email: string; specialization: string; degree?: string | null; imageUrl?: string | null };
type LinkedDoctor = { id: number; name: string; email: string };

interface ManageDoctorsPanelProps {
  clinicData: { doctors?: DoctorEntry[] | null } | null | undefined;
  linkedDoctors: LinkedDoctor[];
  allDoctorLeaves: DoctorLeave[];
  todayStr: string;
  expandedLeaves: Set<string>;
  setExpandedLeaves: (fn: (prev: Set<string>) => Set<string>) => void;
  showAddDoctorForm: boolean;
  setShowAddDoctorForm: (fn: (v: boolean) => boolean) => void;
  newDoctorName: string; setNewDoctorName: (v: string) => void;
  newDoctorEmail: string; setNewDoctorEmail: (v: string) => void;
  newDoctorSpecialization: string; setNewDoctorSpecialization: (v: string) => void;
  newDoctorDegree: string; setNewDoctorDegree: (v: string) => void;
  newDoctorImageUrl: string; setNewDoctorImageUrl: (v: string) => void;
  handleAddDoctor: () => void;
  addDoctorMutation: { isPending: boolean };
  setResetPwdOpen: (open: boolean) => void;
  setResetPwdDoctorId: (id: number | null) => void;
  setResetPwdDoctorName: (name: string) => void;
  setResetPwdDoctorEmail: (email: string) => void;
  setResetPwdNew: (pw: string) => void;
  setResetPwdConfirm: (pw: string) => void;
  removeDoctorMutation: { mutate: (index: number) => void; isPending: boolean };
}

export default function ManageDoctorsPanel({
  clinicData,
  linkedDoctors,
  allDoctorLeaves,
  todayStr,
  expandedLeaves, setExpandedLeaves,
  showAddDoctorForm, setShowAddDoctorForm,
  newDoctorName, setNewDoctorName,
  newDoctorEmail, setNewDoctorEmail,
  newDoctorSpecialization, setNewDoctorSpecialization,
  newDoctorDegree, setNewDoctorDegree,
  newDoctorImageUrl, setNewDoctorImageUrl,
  handleAddDoctor,
  addDoctorMutation,
  setResetPwdOpen,
  setResetPwdDoctorId,
  setResetPwdDoctorName,
  setResetPwdDoctorEmail,
  setResetPwdNew,
  setResetPwdConfirm,
  removeDoctorMutation,
}: ManageDoctorsPanelProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="flex border-b border-border/40">
        <div className="w-1.5 bg-teal-500/60 shrink-0" />
        <div className="flex-1 px-5 py-4 bg-gradient-to-r from-teal-500/[0.06] to-transparent flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Stethoscope className="h-[18px] w-[18px] text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Manage Doctors</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add and manage practitioners</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-700 dark:text-teal-400 bg-teal-500/[0.08] shrink-0">
            {clinicData?.doctors?.length || 0} {(clinicData?.doctors?.length || 0) === 1 ? 'doctor' : 'doctors'}
          </Badge>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="border-t border-border/30">
          <div className="space-y-4">

          {/* Add New Doctor toggle */}
          <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm">
            <button
              onClick={() => setShowAddDoctorForm(v => !v)}
              className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-accent px-5 py-3.5 min-h-[52px] active:opacity-90 transition-opacity"
              data-testid="button-toggle-add-doctor-form"
              aria-expanded={showAddDoctorForm}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm leading-tight">Add a New Doctor</p>
                  <p className="text-white/70 text-xs">Register a new practitioner</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-white/80 transition-transform duration-200 ${showAddDoctorForm ? 'rotate-180' : ''}`} />
            </button>

            {showAddDoctorForm && (
              <div className="p-5 bg-card">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2 flex flex-col items-center lg:items-start">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor Photo</Label>
                    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 w-fit">
                      <ImageUpload
                        currentImage={newDoctorImageUrl || undefined}
                        onImageUploaded={(url) => setNewDoctorImageUrl(url)}
                        folder="doctors"
                        fallbackText={newDoctorName ? newDoctorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : "Dr"}
                      />
                      <p className="text-xs text-muted-foreground text-center">Click photo to upload</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="doctor-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</Label>
                      <Input
                        id="doctor-name"
                        value={newDoctorName}
                        onChange={(e) => setNewDoctorName(e.target.value)}
                        onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        placeholder="e.g. Dr. Priya Sharma"
                        data-testid="input-doctor-name"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="doctor-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
                      <Input
                        id="doctor-email"
                        type="email"
                        value={newDoctorEmail}
                        onChange={(e) => setNewDoctorEmail(e.target.value)}
                        onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        placeholder="doctor@example.com"
                        data-testid="input-doctor-email"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="doctor-specialization" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialization</Label>
                        <SpecializationInput
                          id="doctor-specialization"
                          value={newDoctorSpecialization}
                          onChange={setNewDoctorSpecialization}
                          placeholder="General Dentist"
                          data-testid="input-doctor-specialization"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="doctor-degree" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Degree (Optional)</Label>
                        <Input
                          id="doctor-degree"
                          value={newDoctorDegree}
                          onChange={(e) => setNewDoctorDegree(e.target.value)}
                          onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                          placeholder="e.g. BDS, MDS"
                          data-testid="input-doctor-degree"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddDoctor}
                      disabled={!newDoctorName || !newDoctorSpecialization || !newDoctorEmail || addDoctorMutation.isPending}
                      className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium shadow-md shadow-primary/20 mt-1"
                      data-testid="button-add-doctor"
                    >
                      {addDoctorMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Add Doctor
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Doctors List */}
          {clinicData?.doctors && clinicData.doctors.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Practice Team</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                  <Stethoscope className="h-3 w-3" />
                  {clinicData.doctors.length} {clinicData.doctors.length === 1 ? "doctor" : "doctors"}
                </span>
              </div>
              <div className="grid gap-3">
                {clinicData.doctors.map((doctor, index) => {
                  const doctorUpcomingLeaves = allDoctorLeaves
                    .filter(l => l.doctorEmail === doctor.email && l.leaveDate >= todayStr)
                    .sort((a, b) => a.leaveDate.localeCompare(b.leaveDate));
                  const isOnLeaveToday = doctorUpcomingLeaves.some(l => l.leaveDate === todayStr);
                  const leavesExpanded = expandedLeaves.has(doctor.email);
                  return (
                    <div
                      key={index}
                      className="relative rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
                      data-testid={`doctor-card-${index}`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-accent via-primary to-accent" />
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent pointer-events-none" />
                      <div className="relative flex items-center gap-4 px-5 py-4 pl-5">
                        <div className="relative shrink-0">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/25 ring-2 ring-primary/10 group-hover:ring-primary/25 transition-all duration-300 flex items-center justify-center overflow-hidden shadow-sm">
                            {doctor.imageUrl ? (
                              <img src={doctor.imageUrl} alt={doctor.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold bg-gradient-to-br from-accent to-primary bg-clip-text text-transparent">
                                {doctor.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="absolute -bottom-1 -right-1 font-mono text-xs font-bold bg-muted border border-border/60 text-muted-foreground px-1 py-px rounded-full leading-none">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm tracking-tight">Dr. {doctor.name}</p>
                            {isOnLeaveToday ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-px rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                On Leave
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-px rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="inline-flex items-center text-xs font-medium bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                              {doctor.specialization}
                            </span>
                            {doctor.degree && (
                              <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-full">
                                <GraduationCap className="h-2.5 w-2.5" />
                                {doctor.degree}
                              </span>
                            )}
                          </div>
                          {doctor.email && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span className="text-xs font-mono text-muted-foreground truncate">{doctor.email}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Desktop: inline buttons */}
                          <div className="hidden sm:flex items-center gap-1">
                            {(() => {
                              const linked = linkedDoctors.find(d => d.email === doctor.email);
                              if (!linked) return null;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 active:scale-[0.98] transition-all"
                                        onClick={() => {
                                          setResetPwdDoctorId(linked.id);
                                          setResetPwdDoctorName(linked.name);
                                          setResetPwdDoctorEmail(linked.email);
                                          setResetPwdNew("");
                                          setResetPwdConfirm("");
                                          setResetPwdOpen(true);
                                        }}
                                        data-testid={`button-reset-password-${index}`}
                                      >
                                        <KeyRound className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Reset password</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all"
                                  data-testid={`button-remove-doctor-${index}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Doctor?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {doctor.name} from your clinic? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeDoctorMutation.mutate(index)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {/* Mobile: MoreHorizontal dropdown */}
                          <div className="sm:hidden">
                            <AlertDialog>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-muted-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                                    data-testid={`button-more-doctor-${index}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {(() => {
                                    const linked = linkedDoctors.find(d => d.email === doctor.email);
                                    if (!linked) return null;
                                    return (
                                      <>
                                        <DropdownMenuItem
                                          className="gap-2 text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-500/10"
                                          onSelect={() => {
                                            setResetPwdDoctorId(linked.id);
                                            setResetPwdDoctorName(linked.name);
                                            setResetPwdDoctorEmail(linked.email);
                                            setResetPwdNew("");
                                            setResetPwdConfirm("");
                                            setResetPwdOpen(true);
                                          }}
                                          data-testid={`menu-reset-password-${index}`}
                                        >
                                          <KeyRound className="h-4 w-4" />
                                          Reset Password
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    );
                                  })()}
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      onSelect={(e) => e.preventDefault()}
                                      data-testid={`menu-remove-doctor-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Remove Doctor
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Doctor?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove {doctor.name} from your clinic? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => removeDoctorMutation.mutate(index)}
                                        className="bg-destructive text-destructive-foreground"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>

                      {/* Leaves section */}
                      {doctorUpcomingLeaves.length > 0 && (
                        <div className="border-t border-border/30">
                          <button
                            onClick={() => setExpandedLeaves(prev => {
                              const next = new Set(prev);
                              if (next.has(doctor.email)) next.delete(doctor.email);
                              else next.add(doctor.email);
                              return next;
                            })}
                            className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors min-h-[44px]"
                            data-testid={`button-toggle-leaves-${index}`}
                          >
                            <div className="flex items-center gap-2">
                              <CalendarOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                {doctorUpcomingLeaves.length} upcoming {doctorUpcomingLeaves.length === 1 ? 'leave' : 'leaves'}
                              </span>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${leavesExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {leavesExpanded && (
                            <div className="px-5 pb-3 space-y-1.5">
                              {doctorUpcomingLeaves.map(leave => (
                                <div key={leave.leaveDate} className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                                    leave.leaveDate === todayStr
                                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                                      : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                                  }`}>
                                    <CalendarOff className="h-3 w-3" />
                                    {format(new Date(leave.leaveDate + 'T00:00:00'), 'EEE, MMM d yyyy')}
                                    {leave.leaveDate === todayStr && <span className="font-bold ml-0.5">(Today)</span>}
                                  </span>
                                  {leave.reason && (
                                    <span className="text-xs text-muted-foreground truncate">— {leave.reason}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-muted/20 rounded-xl border border-dashed">
              <div className="p-3 bg-muted/50 rounded-full w-fit mx-auto mb-3">
                <Stethoscope className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-muted-foreground">No doctors added yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add your first doctor using the form above</p>
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );
}
