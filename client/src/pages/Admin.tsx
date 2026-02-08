import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check, LogIn, FlaskConical, LogOut, Copy, ExternalLink, Activity, Database, Trash2, UserPlus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, API_BASE_URL } from "@/lib/queryClient";
import type { Clinic } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Admin() {
  const { user, isAuthenticated, isLoading: authLoading, loginError, isLoggingIn } = useAuth();
  const [_, setLocation] = useLocation();
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicAddress, setNewClinicAddress] = useState("");
  const [newClinicEmail, setNewClinicEmail] = useState("");
  const [newClinicPhone, setNewClinicPhone] = useState("");
  const [newClinicWebsite, setNewClinicWebsite] = useState("");
  const [newClinicDoctorName, setNewClinicDoctorName] = useState("");
  const [newClinicDoctorSpecialization, setNewClinicDoctorSpecialization] = useState("");
  const [newClinicDoctorDegree, setNewClinicDoctorDegree] = useState("");
  const [newClinicUsername, setNewClinicUsername] = useState("");
  const [newClinicPassword, setNewClinicPassword] = useState("");
  const [newClinicDoctors, setNewClinicDoctors] = useState<{ name: string; specialization: string; degree: string; email: string }[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [editClinicDialogOpen, setEditClinicDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editDoctors, setEditDoctors] = useState<{ name: string; specialization: string; degree: string }[]>([]);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { toast } = useToast();

  const [logsEnabled, setLogsEnabled] = useState(true);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [backendRes, dbRes, logsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/health/backend`, { cache: 'no-store' }),
          fetch(`${API_BASE_URL}/api/health/database`, { cache: 'no-store' }),
          fetch(`${API_BASE_URL}/api/admin/logs/status`)
        ]);
        
        setBackendStatus(backendRes.ok ? 'online' : 'offline');
        setDbStatus(dbRes.ok ? 'online' : 'offline');
        
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogCount(logsData.count || 0);
          setLogsEnabled(logsData.enabled);
        }
      } catch (err) {
        console.error("Status check failed:", err);
        setBackendStatus('offline');
        setDbStatus('offline');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleLogs = async (enabled: boolean) => {
    try {
      const res = await apiRequest('POST', '/api/admin/logs/toggle', { enabled });
      if (res.ok) {
        setLogsEnabled(enabled);
        toast({ title: `Server logs ${enabled ? 'enabled' : 'disabled'}` });
      }
    } catch (err: any) {
      toast({ title: "Failed to toggle logs", description: err.message, variant: "destructive" });
    }
  };

  const { data: clinics, isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics', { includeArchived: true }],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/clinics?includeArchived=true');
      if (!res.ok) throw new Error("Failed to fetch clinics");
      return res.json();
    }
  });

  const createClinicMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      address: string; 
      email?: string;
      phone?: string;
      website?: string;
      doctors?: { name: string; specialization: string; degree: string }[];
    }) => {
      const res = await apiRequest('POST', '/api/clinics', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add clinic");
      }
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

  const claimSuperuserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/claim-superuser');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "You are now a superuser!", description: "Please refresh the page." });
      window.location.reload();
    }
  });

  useEffect(() => {
    if (!authLoading && user && user.role !== 'superuser') {
      toast({ title: "Access Denied", variant: "destructive" });
      setLocation("/dashboard");
    }
  }, [authLoading, user, setLocation]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('POST', '/api/auth/admin/login', { email: adminEmail, password: adminPassword });
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData(['/api/auth/user'], data.user);
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        toast({ title: "Login successful" });
      } else {
        const error = await res.json();
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Login error", description: error.message, variant: "destructive" });
    }
  };

  const handleAdminLogout = async () => {
    try {
      const res = await apiRequest('POST', '/api/auth/admin/logout');
      if (res.ok) {
        queryClient.setQueryData(['/api/auth/user'], null);
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        toast({ title: "Logged out successfully" });
        setLocation("/admin");
      }
    } catch (error: any) {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>Enter your admin credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input id="admin-password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeClinics = Array.isArray(clinics) ? clinics.filter(c => !c.isArchived && c.status === 'approved') : [];
  const archivedClinics = Array.isArray(clinics) ? clinics.filter(c => c.isArchived) : [];
  const pendingClinics = Array.isArray(clinics) ? clinics.filter(c => c.status === 'pending') : [];

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
                  <Input id="address" value={newClinicAddress} onChange={(e) => setNewClinicAddress(e.target.value)} className="col-span-3" />
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
                        />
                        <Input
                          placeholder="Doctor email (Optional)"
                          value={doctor.email || ""}
                          onChange={(e) => {
                            const updated = [...newClinicDoctors];
                            updated[index].email = e.target.value;
                            setNewClinicDoctors(updated);
                          }}
                          className="h-8"
                          data-testid={`input-doctor-email-${index}`}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="h-4 w-4 mr-2 text-primary" />
              Backend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold capitalize">{backendStatus}</span>
              <Badge variant={backendStatus === 'online' ? "default" : "destructive"}>{backendStatus}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Database className="h-4 w-4 mr-2 text-primary" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold capitalize">{dbStatus}</span>
              <Badge variant={dbStatus === 'online' ? "default" : "destructive"}>{dbStatus}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <FlaskConical className="h-4 w-4 mr-2 text-primary" />
              Server Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-2xl font-bold">{logCount}</span>
                <span className="text-xs text-muted-foreground">Records in DB</span>
              </div>
              <Switch checked={logsEnabled} onCheckedChange={toggleLogs} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
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
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Clinics</CardTitle>
              <CardDescription>Manage your active medical facilities</CardDescription>
            </CardHeader>
            <CardContent>
              {clinicsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeClinics.map((clinic) => (
                    <Card key={clinic.id} className="overflow-hidden border-muted-foreground/20 hover:border-primary/50 transition-colors">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-lg truncate">{clinic.name}</CardTitle>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 mr-1 shrink-0" />
                              <span className="truncate">{clinic.address}</span>
                            </div>
                          </div>
                          {clinic.logoUrl && (
                            <img src={clinic.logoUrl} alt={clinic.name} className="h-10 w-10 rounded-md object-cover border shrink-0" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                              {Array.isArray(clinic.doctors) ? clinic.doctors.length : 0} Doctors
                            </Badge>
                            {clinic.website && (
                              <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t mt-3">
                            <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => {
                              setSelectedClinic(clinic);
                              setEditName(clinic.name);
                              setEditAddress(clinic.address || "");
                              setEditEmail(clinic.email || "");
                              setEditPhone(clinic.phone || "");
                              setEditWebsite(clinic.website || "");
                              setEditDoctors(Array.isArray(clinic.doctors) ? clinic.doctors as any : []);
                              setEditClinicDialogOpen(true);
                            }}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => {
                              setSelectedClinic(clinic);
                              setEditUsername(clinic.username || "");
                              setCredentialsDialogOpen(true);
                            }}>
                              <Key className="h-3 w-3 mr-1" />
                              Creds
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => archiveClinicMutation.mutate(clinic.id)}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {activeClinics.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/30">
                      <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-20" />
                      <p className="text-muted-foreground font-medium">No active clinics found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Add a new clinic to get started</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Registration</CardTitle>
              <CardDescription>Review and approve new clinic requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingClinics.map((clinic) => (
                  <Card key={clinic.id} className="border-yellow-500/20 bg-yellow-500/5">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{clinic.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {clinic.address}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Pending</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-muted-foreground">Email: {clinic.email || 'N/A'}</div>
                          <div className="text-muted-foreground">Phone: {clinic.phone || 'N/A'}</div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-9" onClick={() => approveClinicMutation.mutate(clinic.id)} disabled={approveClinicMutation.isPending}>
                            {approveClinicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 h-9 text-destructive hover:bg-destructive/5" onClick={() => archiveClinicMutation.mutate(clinic.id)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {pendingClinics.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/30">
                    <Check className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-20" />
                    <p className="text-muted-foreground font-medium">No pending registrations</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">New clinic requests will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle>Archived Clinics</CardTitle>
              <CardDescription>View and restore previously active clinics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedClinics.map((clinic) => (
                  <Card key={clinic.id} className="opacity-70 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all border-muted">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-lg text-muted-foreground">{clinic.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => unarchiveClinicMutation.mutate(clinic.id)}>
                        <ArchiveRestore className="h-3 w-3 mr-1" />
                        Restore Clinic
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {archivedClinics.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/30">
                    <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-20" />
                    <p className="text-muted-foreground font-medium">No archived clinics</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Clinic Dialog */}
      <Dialog open={editClinicDialogOpen} onOpenChange={setEditClinicDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Clinic</DialogTitle>
            <DialogDescription>Update the clinic details and doctor information.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-address" className="text-right">Address</Label>
              <Input id="edit-address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">Email</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">Phone</Label>
              <Input id="edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-website" className="text-right">Website</Label>
              <Input id="edit-website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="col-span-3" />
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Doctors ({editDoctors.length})
                </p>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditDoctors([...editDoctors, { name: '', specialization: '', degree: '' }])}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Add Doctor
                </Button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {editDoctors.map((doctor, index) => (
                  <div key={index} className="p-3 border rounded-md space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Doctor {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setEditDoctors(editDoctors.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Doctor name"
                      value={doctor.name}
                      onChange={(e) => {
                        const updated = [...editDoctors];
                        updated[index].name = e.target.value;
                        setEditDoctors(updated);
                      }}
                      className="h-8"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Specialization"
                        value={doctor.specialization}
                        onChange={(e) => {
                          const updated = [...editDoctors];
                          updated[index].specialization = e.target.value;
                          setEditDoctors(updated);
                        }}
                        className="h-8"
                      />
                      <Input
                        placeholder="Degree"
                        value={doctor.degree}
                        onChange={(e) => {
                          const updated = [...editDoctors];
                          updated[index].degree = e.target.value;
                          setEditDoctors(updated);
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateClinicMutation.mutate({ 
              id: selectedClinic!.id,
              name: editName, 
              address: editAddress,
              email: editEmail,
              phone: editPhone,
              website: editWebsite,
              doctors: editDoctors.filter(d => d.name.trim() !== '')
            })} disabled={updateClinicMutation.isPending || !editName || !editAddress}>
              {updateClinicMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Credentials</DialogTitle>
            <DialogDescription>Set a new username and password for {selectedClinic?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">Username</Label>
              <Input id="edit-username" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-pass" className="text-right">Password</Label>
              <div className="col-span-3 relative">
                <Input id="edit-pass" type={showPassword ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentialsMutation.mutate({ 
              clinicId: selectedClinic!.id, 
              username: editUsername, 
              password: editPassword 
            })} disabled={setCredentialsMutation.isPending || !editUsername || !editPassword}>
              {setCredentialsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
