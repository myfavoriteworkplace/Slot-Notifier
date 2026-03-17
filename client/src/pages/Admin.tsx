import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check, LogIn, LogOut, Copy, ExternalLink, Trash2, UserPlus, Stethoscope, Sparkles, Image as ImageIcon, Link as LinkIcon, Megaphone, Mail, Phone, Globe, Hash, CalendarDays, CheckCircle2, Navigation, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Clinic, SmileDeal } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function Admin() {
  const { user, loading: authLoading, logout, login, isLoggingIn, loginError } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Create clinic state
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicAddress, setNewClinicAddress] = useState("");
  const [newClinicCity, setNewClinicCity] = useState("");
  const [newClinicPincode, setNewClinicPincode] = useState("");
  const [newClinicEmail, setNewClinicEmail] = useState("");
  const [newClinicPhone, setNewClinicPhone] = useState("");
  const [newClinicWebsite, setNewClinicWebsite] = useState("");
  const [newClinicDoctors, setNewClinicDoctors] = useState<{ name: string; specialization: string; degree: string; email: string }[]>([]);
  const [newClinicUsername, setNewClinicUsername] = useState("");
  const [newClinicPassword, setNewClinicPassword] = useState("");

  // Edit clinic state
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [editClinicDialogOpen, setEditClinicDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editDoctors, setEditDoctors] = useState<{ name: string; specialization: string; degree: string; email?: string }[]>([]);

  // Credentials dialog state
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Smile Deals state
  const [dealTitle, setDealTitle] = useState("");
  const [dealDescription, setDealDescription] = useState("");
  const [dealImageUrl, setDealImageUrl] = useState("");
  const [dealBookingLink, setDealBookingLink] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: smileDeals = [], isLoading: dealsLoading } = useQuery<SmileDeal[]>({
    queryKey: ['/api/smile-deals'],
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/admin/smile-deals', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smile-deals'] });
      setDealTitle("");
      setDealDescription("");
      setDealImageUrl("");
      setDealBookingLink("");
      setDealPrice("");
      toast({ title: "Smile Deal added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add deal", description: error.message, variant: "destructive" });
    }
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SmileDeal> }) => {
      const res = await apiRequest('PATCH', `/api/admin/smile-deals/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smile-deals'] });
      toast({ title: "Smile Deal updated" });
    }
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/admin/smile-deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smile-deals'] });
      toast({ title: "Smile Deal deleted" });
    }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Get signed URL
      const signedRes = await apiRequest('POST', '/api/uploads/signed-url', {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        folder: 'smile-deals'
      });
      if (!signedRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await signedRes.json();

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!uploadRes.ok) throw new Error("R2 Upload failed");

      setDealImageUrl(publicUrl);
      toast({ title: "Image uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const { data: clinics = [], isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics'],
  });

  const createClinicMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/clinics', data);
      return res.json();
    },
    onSuccess: async (clinic) => {
      if (newClinicUsername && newClinicPassword) {
        await setCredentialsMutation.mutateAsync({ 
          clinicId: clinic.id, 
          username: newClinicUsername, 
          password: newClinicPassword 
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setNewClinicName("");
      setNewClinicAddress("");
      setNewClinicCity("");
      setNewClinicPincode("");
      setNewClinicEmail("");
      setNewClinicPhone("");
      setNewClinicWebsite("");
      setNewClinicDoctors([]);
      setNewClinicUsername("");
      setNewClinicPassword("");
      toast({ title: "Clinic added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add clinic", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const setCredentialsMutation = useMutation({
    mutationFn: async (data: { clinicId: number; username: string; password: string }) => {
      const res = await apiRequest('PATCH', `/api/clinics/${data.clinicId}/credentials`, {
        username: data.username,
        password: data.password,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update credentials");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setCredentialsDialogOpen(false);
      setSelectedClinic(null);
      setEditUsername("");
      setEditPassword("");
      toast({ title: "Credentials updated successfully" });
    },
  });

  const archiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/clinics/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic archived" });
    }
  });

  const unarchiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/clinics/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic restored" });
    }
  });

  const updateClinicMutation = useMutation({
    mutationFn: async (data: { 
      id: number;
      name: string; 
      address: string;
      city?: string;
      pincode?: string;
      email?: string;
      phone?: string;
      website?: string;
      doctors?: { name: string; specialization: string; degree: string; email?: string }[];
    }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest('PATCH', `/api/clinics/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setEditClinicDialogOpen(false);
      setSelectedClinic(null);
      toast({ title: "Clinic updated successfully" });
    }
  });

  const approveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PATCH', `/api/clinics/${id}/approve`);
      if (!res.ok) throw new Error("Failed to approve clinic");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic approved" });
    }
  });

  const handleAdminLogout = () => {
    logout();
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    login({ email: loginEmail, password: loginPassword });
  };

  useEffect(() => {
    if (!authLoading && user && user.role !== 'superuser') {
      toast({ title: "Access Denied", variant: "destructive" });
      setLocation("/dashboard");
    }
  }, [authLoading, user, setLocation, toast]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'superuser') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-primary/5 to-transparent px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-2">Admin Login</CardTitle>
            <CardDescription>Enter your credentials to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isLoggingIn}
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="label-password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoggingIn}
                    data-testid="input-admin-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    disabled={isLoggingIn}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {loginError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                  {(loginError as any)?.message || "Login failed. Please try again."}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-admin-login">
                {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-home">
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (clinicsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeClinics = clinics.filter(c => c.status === 'approved' && !c.isArchived);
  const pendingClinics = clinics.filter(c => c.status === 'pending');
  const archivedClinics = clinics.filter(c => c.isArchived);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Admin Panel</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage clinics and application settings</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Add Clinic
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Clinic</DialogTitle>
                <DialogDescription>Enter the clinic details and create an admin account.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={newClinicName} onChange={(e) => setNewClinicName(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">Address</Label>
                  <Input id="address" value={newClinicAddress} onChange={(e) => setNewClinicAddress(e.target.value)} className="col-span-3" placeholder="Street / Building" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="city" className="text-right">City</Label>
                  <Input id="city" value={newClinicCity} onChange={(e) => setNewClinicCity(e.target.value)} className="col-span-3" placeholder="e.g. Kochi" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="pincode" className="text-right">Pincode</Label>
                  <Input id="pincode" value={newClinicPincode} onChange={(e) => setNewClinicPincode(e.target.value)} className="col-span-3" placeholder="e.g. 682001" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={newClinicEmail} onChange={(e) => setNewClinicEmail(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <Input id="phone" value={newClinicPhone} onChange={(e) => setNewClinicPhone(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="website" className="text-right">Website</Label>
                  <Input id="website" value={newClinicWebsite} onChange={(e) => setNewClinicWebsite(e.target.value)} className="col-span-3" />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Doctors ({newClinicDoctors.length})
                    </p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setNewClinicDoctors([...newClinicDoctors, { name: '', specialization: '', degree: '', email: '' }])}
                      data-testid="button-add-doctor"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Add Doctor
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {newClinicDoctors.map((doctor, index) => (
                      <div key={index} className="p-3 border rounded-md space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Doctor {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setNewClinicDoctors(newClinicDoctors.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Doctor name"
                          value={doctor.name}
                          onChange={(e) => {
                            const updated = [...newClinicDoctors];
                            updated[index].name = e.target.value;
                            setNewClinicDoctors(updated);
                          }}
                          className="h-8"
                          data-testid={`input-doctor-name-${index}`}
                          required
                        />
                        <Input
                          placeholder="Doctor email"
                          type="email"
                          value={doctor.email || ""}
                          onChange={(e) => {
                            const updated = [...newClinicDoctors];
                            updated[index].email = e.target.value;
                            setNewClinicDoctors(updated);
                          }}
                          className="h-8"
                          data-testid={`input-doctor-email-${index}`}
                          required
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Specialization"
                            value={doctor.specialization}
                            onChange={(e) => {
                              const updated = [...newClinicDoctors];
                              updated[index].specialization = e.target.value;
                              setNewClinicDoctors(updated);
                            }}
                            className="h-8"
                            data-testid={`input-doctor-specialization-${index}`}
                            required
                          />
                          <Input
                            placeholder="Degree"
                            value={doctor.degree}
                            onChange={(e) => {
                              const updated = [...newClinicDoctors];
                              updated[index].degree = e.target.value;
                              setNewClinicDoctors(updated);
                            }}
                            className="h-8"
                            data-testid={`input-doctor-degree-${index}`}
                          />
                        </div>
                      </div>
                    ))}
                    {newClinicDoctors.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No doctors added yet. Click "Add Doctor" to add one.</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-4">Admin Account Credentials</p>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="username" className="text-right">Username</Label>
                      <Input id="username" value={newClinicUsername} onChange={(e) => setNewClinicUsername(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="pass" className="text-right">Password</Label>
                      <div className="col-span-3 relative">
                        <Input id="pass" type={showPassword ? "text" : "password"} value={newClinicPassword} onChange={(e) => setNewClinicPassword(e.target.value)} />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createClinicMutation.mutate({ 
                  name: newClinicName, 
                  address: newClinicAddress,
                  city: newClinicCity,
                  pincode: newClinicPincode,
                  email: newClinicEmail,
                  phone: newClinicPhone,
                  website: newClinicWebsite,
                  doctors: newClinicDoctors.filter(d => d.name.trim() !== '')
                })} disabled={createClinicMutation.isPending || !newClinicName || !newClinicAddress}>
                  {createClinicMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Clinic
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleAdminLogout} className="h-9">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Active ({activeClinics.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Pending ({pendingClinics.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archived ({archivedClinics.length})
          </TabsTrigger>
          <TabsTrigger value="smile-deals" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Smile Deals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Active Clinics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeClinics.map((clinic) => (
                  <div key={clinic.id} className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow duration-300">

                    {/* Header */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                      <div className="flex items-start justify-between gap-4 pl-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold tracking-tight">{clinic.name}</h3>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Active
                            </span>
                          </div>

                          {/* Location row */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            {clinic.address && (
                              <span className="text-xs text-muted-foreground">{clinic.address}</span>
                            )}
                            {(clinic as any).city && (
                              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                                <Navigation className="h-2.5 w-2.5" />
                                {(clinic as any).city}
                              </span>
                            )}
                            {(clinic as any).pincode && (
                              <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground border border-border/60 px-2 py-0.5 rounded-full font-mono">
                                <Hash className="h-2.5 w-2.5" />
                                {(clinic as any).pincode}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/book/${clinic.id}`;
                              navigator.clipboard.writeText(url);
                              toast({ title: "Booking URL copied" });
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy Link
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                            setSelectedClinic(clinic);
                            setEditName(clinic.name);
                            setEditAddress(clinic.address || "");
                            setEditCity((clinic as any).city || "");
                            setEditPincode((clinic as any).pincode || "");
                            setEditEmail(clinic.email || "");
                            setEditPhone(clinic.phone || "");
                            setEditWebsite(clinic.website || "");
                            setEditDoctors(clinic.doctors || []);
                            setEditClinicDialogOpen(true);
                          }}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                            setSelectedClinic(clinic);
                            setEditUsername("");
                            setEditPassword("");
                            setCredentialsDialogOpen(true);
                          }}>
                            <Key className="h-3.5 w-3.5 mr-1" />
                            Creds
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => archiveClinicMutation.mutate(clinic.id)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Contact info */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contact Details</p>
                        <div className="space-y-2">
                          {clinic.email && (
                            <div className="flex items-center gap-3 group">
                              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center shrink-0">
                                <Mail className="h-3.5 w-3.5 text-blue-500" />
                              </div>
                              <a href={`mailto:${clinic.email}`} className="text-xs text-foreground hover:text-primary transition-colors truncate">
                                {clinic.email}
                              </a>
                            </div>
                          )}
                          {clinic.phone && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center shrink-0">
                                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                              <span className="text-xs text-foreground font-mono">{clinic.phone}</span>
                            </div>
                          )}
                          {clinic.website && (
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900 flex items-center justify-center shrink-0">
                                <Globe className="h-3.5 w-3.5 text-violet-500" />
                              </div>
                              <a href={clinic.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                                {clinic.website.replace(/^https?:\/\//, '')}
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 flex items-center justify-center shrink-0">
                              <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Added {clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Doctors */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Stethoscope className="h-3 w-3" />
                          Doctors
                        </p>
                        <div className="space-y-2">
                          {clinic.doctors && clinic.doctors.length > 0 ? (
                            clinic.doctors.map((doc, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {doc.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium leading-tight truncate">{doc.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{doc.specialization}{doc.degree ? ` · ${doc.degree}` : ''}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No doctors listed</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {activeClinics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No active clinics found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center text-primary">
                <Sparkles className="h-5 w-5 mr-2" />
                Pending Registrations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingClinics.map((clinic) => (
                  <div key={clinic.id} className="border rounded-lg overflow-hidden bg-background shadow-sm border-primary/20">
                    <div className="flex items-center justify-between p-4 bg-primary/5">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {clinic.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {clinic.address}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveClinicMutation.mutate(clinic.id)}
                          disabled={approveClinicMutation.isPending}
                          className="h-8 gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `${window.location.origin}/book/${clinic.id}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Booking URL copied" });
                          }}
                          className="h-8 gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClinic(clinic);
                            setEditName(clinic.name);
                            setEditAddress(clinic.address || "");
                            setEditCity((clinic as any).city || "");
                            setEditPincode((clinic as any).pincode || "");
                            setEditEmail(clinic.email || "");
                            setEditPhone(clinic.phone || "");
                            setEditWebsite(clinic.website || "");
                            setEditDoctors(clinic.doctors || []);
                            setEditClinicDialogOpen(true);
                          }}
                          className="h-8"
                        >
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => archiveClinicMutation.mutate(clinic.id)}>
                          Reject
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t">
                      <div className="space-y-2">
                        <p className="font-medium text-muted-foreground flex items-center gap-2 mb-1">
                          <Stethoscope className="h-4 w-4" />
                          Doctors
                        </p>
                        <div className="space-y-1.5">
                          {clinic.doctors && clinic.doctors.length > 0 ? (
                            clinic.doctors.map((doc, idx) => (
                              <div key={idx} className="flex flex-col border-l-2 border-primary/20 pl-2 py-0.5">
                                <span className="font-medium">{doc.name}</span>
                                <span className="text-xs text-muted-foreground">{doc.specialization} • {doc.degree}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic">No doctors listed</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-medium text-muted-foreground flex items-center gap-2 mb-1">
                          <Plus className="h-4 w-4" />
                          Clinic Details
                        </p>
                        <div className="grid grid-cols-1 gap-1 text-xs">
                          <div className="flex justify-between border-b border-border/50 py-1">
                            <span className="text-muted-foreground">Email:</span>
                            <span>{clinic.email}</span>
                          </div>
                          <div className="flex justify-between border-b border-border/50 py-1">
                            <span className="text-muted-foreground">Phone:</span>
                            <span>{clinic.phone}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">Registered:</span>
                            <span>{clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingClinics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No pending registrations.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-muted-foreground">
                <Archive className="h-5 w-5 mr-2" />
                Archived Clinics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {archivedClinics.map((clinic) => (
                  <div key={clinic.id} className="flex items-center justify-between p-4 border rounded-lg opacity-60">
                    <div>
                      <h3 className="font-medium">{clinic.name}</h3>
                      <p className="text-sm text-muted-foreground">{clinic.address}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => unarchiveClinicMutation.mutate(clinic.id)}>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                ))}
                {archivedClinics.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No archived clinics.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smile-deals">
          <div className="space-y-6">

            {/* Deal Creator Panel */}
            <Card className="overflow-hidden shadow-md border-0">
              <div className="bg-gradient-to-r from-violet-600 to-primary px-6 py-4 flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg leading-tight">Create a New Deal</h2>
                  <p className="text-white/70 text-sm">Add a promotional offer to the Smile Deals page</p>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid gap-6 lg:grid-cols-2">

                  {/* Left: Image Upload Zone */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Deal Image</Label>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    {dealImageUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border-2 border-primary/30 aspect-video bg-muted">
                        <img src={dealImageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Change Image
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full aspect-video border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer"
                      >
                        {isUploading ? (
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        ) : (
                          <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-sm font-medium text-primary">Click to upload image</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP supported</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Right: Form Fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deal-title">Deal Title</Label>
                      <Input id="deal-title" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="50% Off Scaling" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="deal-price">Price (₹)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
                          <Input id="deal-price" value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} placeholder="499" className="pl-7" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deal-link">Booking Link</Label>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="deal-link" value={dealBookingLink} onChange={(e) => setDealBookingLink(e.target.value)} placeholder="/book/123" className="pl-9" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deal-desc">Description</Label>
                      <Textarea id="deal-desc" value={dealDescription} onChange={(e) => setDealDescription(e.target.value)} placeholder="Enter deal details..." className="resize-none h-[88px]" />
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-violet-600 to-primary hover:from-violet-700 hover:to-primary/90 text-white font-medium shadow-md shadow-primary/20"
                      onClick={() => createDealMutation.mutate({ title: dealTitle, description: dealDescription, imageUrl: dealImageUrl, bookingLink: dealBookingLink, price: dealPrice })}
                      disabled={createDealMutation.isPending || !dealTitle || !dealImageUrl}
                    >
                      {createDealMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Publish Deal
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Running Deals */}
            <Card className="shadow-md border-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-5 w-5 text-primary" />
                    Running Deals
                  </CardTitle>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {smileDeals.filter(d => d.isActive).length} Active
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {smileDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                      deal.isActive
                        ? "border-l-4 border-l-green-500 border-t border-r border-b"
                        : "border-l-4 border-l-muted-foreground/30 border-t border-r border-b opacity-60"
                    }`}
                  >
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-sm"
                      onError={(e) => (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-sm">{deal.title}</h4>
                        {deal.price && (
                          <span className="inline-flex items-center text-xs font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800 px-2 py-0.5 rounded-full">
                            ₹{deal.price}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{deal.description}</p>
                      {deal.bookingLink && (
                        <a href={deal.bookingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <LinkIcon className="h-3 w-3" />
                          {deal.bookingLink}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${deal.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        <span className="text-xs text-muted-foreground">{deal.isActive ? "Active" : "Stopped"}</span>
                      </div>
                      <Switch
                        checked={deal.isActive}
                        onCheckedChange={(checked) => updateDealMutation.mutate({ id: deal.id, updates: { isActive: checked } })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        onClick={() => deleteDealMutation.mutate(deal.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {smileDeals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="p-4 bg-muted/50 rounded-full">
                      <Megaphone className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-muted-foreground">No deals configured yet</p>
                    <p className="text-xs text-muted-foreground/70">Create your first deal using the form above</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Clinic Dialog */}
      <Dialog open={editClinicDialogOpen} onOpenChange={setEditClinicDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Clinic</DialogTitle>
            <DialogDescription>Update details for {selectedClinic?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-address" className="text-right">Address</Label>
              <Input id="edit-address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="col-span-3" placeholder="Street / Building" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-city" className="text-right">City</Label>
              <Input id="edit-city" value={editCity} onChange={(e) => setEditCity(e.target.value)} className="col-span-3" placeholder="e.g. Kochi" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-pincode" className="text-right">Pincode</Label>
              <Input id="edit-pincode" value={editPincode} onChange={(e) => setEditPincode(e.target.value)} className="col-span-3" placeholder="e.g. 682001" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateClinicMutation.mutate({ id: selectedClinic!.id, name: editName, address: editAddress, city: editCity, pincode: editPincode })} disabled={updateClinicMutation.isPending}>
              {updateClinicMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Credentials</DialogTitle>
            <DialogDescription>Set username and password for {selectedClinic?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cred-user" className="text-right">Username</Label>
              <Input id="cred-user" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cred-pass" className="text-right">Password</Label>
              <Input id="cred-pass" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentialsMutation.mutate({ clinicId: selectedClinic!.id, username: editUsername, password: editPassword })} disabled={setCredentialsMutation.isPending}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
