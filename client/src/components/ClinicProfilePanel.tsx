import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import MapLocationPicker from "@/components/MapLocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Lock, ExternalLink, Phone, Mail, Globe, MapPin, User, Loader2,
} from "lucide-react";

interface Props {
  clinic: any;
  refetchClinic?: () => void;
}

export default function ClinicProfilePanel({ clinic, refetchClinic }: Props) {
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileWebsite, setProfileWebsite] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profilePincode, setProfilePincode] = useState("");
  const [profileDoctorName, setProfileDoctorName] = useState("");
  const [profileLatitude, setProfileLatitude] = useState<number | null>(null);
  const [profileLongitude, setProfileLongitude] = useState<number | null>(null);

  useEffect(() => {
    if (clinic) {
      setProfilePhone(clinic.phone ?? "");
      setProfileEmail(clinic.email ?? "");
      setProfileWebsite(clinic.website ?? "");
      setProfileAddress(clinic.address ?? "");
      setProfileCity(clinic.city ?? "");
      setProfilePincode(clinic.pincode ?? "");
      setProfileDoctorName((clinic as any).doctorName ?? "");
      setProfileLatitude((clinic as any).latitude ?? null);
      setProfileLongitude((clinic as any).longitude ?? null);
    }
  }, [clinic]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { phone?: string; email?: string; website?: string; address?: string; city?: string; pincode?: string; doctorName?: string; latitude?: number | null; longitude?: number | null }) => {
      const response = await apiRequest('PATCH', '/api/auth/clinic/me', data);
      if (!response.ok) throw new Error('Failed to update clinic profile');
      return response.json();
    },
    onSuccess: () => {
      if (refetchClinic) refetchClinic();
      queryClient.invalidateQueries({ queryKey: ['/api/auth/clinic/me'] });
      notify.success("Profile updated", { description: "Your clinic profile has been saved." });
    },
    onError: (err: any) => {
      notify.apiError(err, "Update failed");
    },
  });

  return (
    <div className="space-y-5">

      {/* Panel header — standalone card */}
      <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
        <div className="flex">
          <div className="w-1.5 bg-violet-500/60 shrink-0" />
          <div className="flex-1 px-5 py-4 bg-gradient-to-r from-violet-500/[0.06] to-transparent flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Building2 className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Clinic Profile</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Update your public About page details</p>
              </div>
            </div>
            <a
              href={`/clinic/${clinic?.username || clinic?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-preview-about"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-colors text-violet-700 dark:text-violet-400 text-xs font-semibold min-h-[44px]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </a>
          </div>
        </div>
      </div>

      {/* Content card — detached */}
      <div className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm">

        {/* Locked identity row */}
        <div className="px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-3">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clinic Name</span>
            <p className="text-sm font-semibold text-foreground truncate">{clinic?.name}</p>
          </div>
          <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground shrink-0">
            Managed by platform
          </Badge>
        </div>

        {/* Editable fields — compact grid */}
        <div className="p-4 bg-card space-y-4">

          {/* All text fields in one tight grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="profile-phone" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="profile-phone"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="pl-8 h-9 text-sm"
                  data-testid="input-profile-phone"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-email" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="profile-email"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="clinic@example.com"
                  className="pl-8 h-9 text-sm"
                  data-testid="input-profile-email"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-website" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Website</Label>
              <div className="relative">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="profile-website"
                  value={profileWebsite}
                  onChange={(e) => setProfileWebsite(e.target.value)}
                  placeholder="https://yourclinic.com"
                  className="pl-8 h-9 text-sm"
                  data-testid="input-profile-website"
                />
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="profile-address" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Street Address</Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="profile-address"
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  placeholder="123 Main Street, Area"
                  className="pl-8 h-9 text-sm"
                  data-testid="input-profile-address"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-city" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">City</Label>
              <Input
                id="profile-city"
                value={profileCity}
                onChange={(e) => setProfileCity(e.target.value)}
                placeholder="Mumbai"
                className="h-9 text-sm"
                data-testid="input-profile-city"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-pincode" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pincode</Label>
              <Input
                id="profile-pincode"
                value={profilePincode}
                onChange={(e) => setProfilePincode(e.target.value)}
                placeholder="400001"
                className="h-9 text-sm"
                data-testid="input-profile-pincode"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-doctor-name" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lead Doctor</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="profile-doctor-name"
                  value={profileDoctorName}
                  onChange={(e) => setProfileDoctorName(e.target.value)}
                  placeholder="e.g. Dr. Arun Menon"
                  className="pl-8 h-9 text-sm"
                  data-testid="input-profile-doctor-name"
                />
              </div>
            </div>
          </div>

          {/* Map location */}
          <div className="border border-border/40 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
              <MapPin className="h-3.5 w-3.5 text-violet-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Map Location</span>
              {profileLatitude && profileLongitude && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                  Pin saved
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Search your clinic or click on the map to set a pin. Patients see this on your public profile.
              </p>
              <MapLocationPicker
                latitude={profileLatitude}
                longitude={profileLongitude}
                onChange={(lat, lng) => { setProfileLatitude(lat); setProfileLongitude(lng); }}
              />
            </div>
          </div>

        </div>

        {/* Save footer */}
        <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-end">
          <Button
            onClick={() => updateProfileMutation.mutate({
              phone: profilePhone,
              email: profileEmail,
              website: profileWebsite,
              address: profileAddress,
              city: profileCity,
              pincode: profilePincode,
              doctorName: profileDoctorName,
              latitude: profileLatitude,
              longitude: profileLongitude,
            })}
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
            className="rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5 transition-all px-6"
          >
            {updateProfileMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
            ) : (
              "Save Profile"
            )}
          </Button>
        </div>

      </div>{/* end content card */}

    </div>
  );
}
