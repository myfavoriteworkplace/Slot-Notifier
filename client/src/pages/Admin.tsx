import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check, LogIn, FlaskConical, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

import { Switch } from "@/components/ui/switch";

export default function Admin() {
  const { user, isAuthenticated, isLoading: authLoading, login, loginError, isLoggingIn } = useAuth();
  const [_, setLocation] = useLocation();
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicAddress, setNewClinicAddress] = useState("");
  const [newClinicUsername, setNewClinicUsername] = useState("");
  const [newClinicPassword, setNewClinicPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { toast } = useToast();

  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  const [logsEnabled, setLogsEnabled] = useState(true);

  // Fetch log status on mount
  useEffect(() => {
    if (isAuthenticated && user?.role === 'superuser') {
      fetch(`${API_BASE_URL}/api/admin/logs/status`)
        .then(res => res.json())
        .then(data => setLogsEnabled(data.enabled))
        .catch(err => console.error("Failed to fetch log status:", err));
    }
  }, [isAuthenticated, user]);

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

  const isDemoSuperAdmin = localStorage.getItem("demo_super_admin") === "true";

  const { data: clinics, isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics', { includeArchived: true }],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/clinics?includeArchived=true`, {
        credentials: 'include',
      });
      const serverClinics = await res.json();
      return Array.isArray(serverClinics) ? serverClinics : [];
    },
  });

  const createClinicMutation = useMutation({
    mutationFn: async (data: { name: string; address: string }) => {
      console.log("[ADMIN-DEBUG] Adding clinic:", data);
      const res = await apiRequest('POST', '/api/clinics', data);
      return res.json();
    },
    onSuccess: async (clinic) => {
      console.log("[ADMIN-DEBUG] Clinic added success:", clinic);

      if (newClinicUsername && newClinicPassword) {
        console.log("[ADMIN-DEBUG] Setting credentials for new clinic");
        await setCredentialsMutation.mutateAsync({ 
          clinicId: clinic.id, 
          username: newClinicUsername, 
          password: newClinicPassword 
        });
      }
      // Explicitly trigger a re-fetch and invalidate all clinic queries
      await queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      
      setNewClinicName("");
      setNewClinicAddress("");
      setNewClinicUsername("");
      setNewClinicPassword("");
      toast({ title: "Clinic added successfully" });
    },
    onError: (error: any) => {
      console.error("[ADMIN-ERROR] Failed to add clinic:", error);
      toast({ 
        title: "Failed to add clinic", 
        description: error.message || "Only super users can add clinics",
        variant: "destructive" 
      });
    },
  });

  const setCredentialsMutation = useMutation({
    mutationFn: async (data: { clinicId: number; username: string; password: string }) => {
      console.log(`[ADMIN-DEBUG] Updating credentials for clinic ${data.clinicId}:`, { username: data.username });
      const res = await apiRequest('PATCH', `/api/clinics/${data.clinicId}/credentials`, {
        username: data.username,
        password: data.password,
      });
      return res.json();
    },
    onSuccess: () => {
      console.log("[ADMIN-DEBUG] Credentials updated success");
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setCredentialsDialogOpen(false);
      setSelectedClinic(null);
      setEditUsername("");
      setEditPassword("");
      toast({ title: "Credentials updated successfully" });
    },
    onError: (error: any) => {
      console.error("[ADMIN-ERROR] Failed to set credentials:", error);
      toast({ 
        title: "Failed to set credentials", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const archiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/clinics/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic archived" });
    },
    onError: () => {
      toast({ title: "Failed to archive clinic", variant: "destructive" });
    },
  });

  const unarchiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/clinics/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore clinic", variant: "destructive" });
    },
  });

  const claimSuperuserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/claim-superuser');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: "You are now a superuser!", description: "Please refresh the page." });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({ 
        title: "Cannot claim superuser", 
        description: error.message || "A superuser already exists",
        variant: "destructive" 
      });
    },
  });

  useEffect(() => {
    if (!authLoading && user && user.role !== 'superuser') {
      toast({ 
        title: "Access Denied", 
        description: "Only super users can access this page",
        variant: "destructive" 
      });
      setLocation("/dashboard");
    }
  }, [authLoading, user, setLocation, toast]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminEmail === "demo_super_admin@bookmyslot.com") {
      console.log("Demo super admin login detected");
      // Use the explicit admin login endpoint which handles session bypass
      try {
        const res = await apiRequest('POST', '/api/auth/admin/login', { 
          email: adminEmail, 
          password: "bypass" 
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log("Demo admin login success:", data);
          queryClient.setQueryData(['/api/auth/user'], data.user);
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          toast({ title: "Login successful (Demo)" });
        }
      } catch (err: any) {
        console.error("Demo login error:", err);
      }
      return;
    }

    if (adminEmail === "demo_clinic" && adminPassword === "demo_password123") {
      login({ email: "demo_clinic", password: "demo_password123" });
      return;
    }
    
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast({ title: "Please enter email and password", variant: "destructive" });
      return;
    }
    
    try {
      console.log("Attempting admin login to /api/auth/admin/login");
      // Use the explicit admin login endpoint for environment-based auth
      const res = await apiRequest('POST', '/api/auth/admin/login', { 
        email: adminEmail, 
        password: adminPassword 
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("Admin login success:", data);
        queryClient.setQueryData(['/api/auth/user'], data.user);
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        toast({ title: "Login successful" });
      } else {
        const error = await res.json();
        console.error("Admin login failed:", error);
        toast({ 
          title: "Login failed", 
          description: error.message || "Invalid credentials",
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error("Admin login error:", error);
      toast({ 
        title: "Login error", 
        description: error.message,
        variant: "destructive" 
      });
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
            <CardDescription>Enter your admin credentials to manage clinics</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Enter password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  data-testid="input-admin-password"
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{(loginError as Error).message}</p>
              )}
              <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-admin-login">
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user?.role !== 'superuser') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only super users can access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeClinics = Array.isArray(clinics) ? clinics.filter(c => !c.isArchived) : [];
  const archivedClinics = Array.isArray(clinics) ? clinics.filter(c => c.isArchived) : [];

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
                <Button onClick={() => createClinicMutation.mutate({ name: newClinicName, address: newClinicAddress })} disabled={createClinicMutation.isPending || !newClinicName || !newClinicAddress}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <FlaskConical className="h-4 w-4 mr-2 text-primary" />
              Server Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">Online</span>
              <Badge variant="default">Running</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Building2 className="h-4 w-4 mr-2 text-primary" />
              Total Clinics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{clinics?.length || 0}</span>
              <Switch checked={logsEnabled} onCheckedChange={toggleLogs} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Clinics ({activeClinics.length})
            </CardTitle>
            <CardDescription>Manage active clinic partners</CardDescription>
          </CardHeader>
          <CardContent>
            {clinicsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y">
                {activeClinics.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No active clinics found.</p>
                ) : (
                  activeClinics.map(clinic => (
                    <div key={clinic.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{clinic.name}</h3>
                            <Badge variant="outline" className="text-[10px] h-4">ID: {clinic.id}</Badge>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 mr-1" /> {clinic.address}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog open={credentialsDialogOpen && selectedClinic?.id === clinic.id} onOpenChange={(open) => {
                            setCredentialsDialogOpen(open);
                            if (open) setSelectedClinic(clinic);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8">
                                <Key className="h-3 w-3 mr-1" /> Credentials
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Credentials</DialogTitle>
                                <DialogDescription>Update login for {clinic.name}</DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label className="text-right">Username</Label>
                                  <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="col-span-3" placeholder="New username" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label className="text-right">Password</Label>
                                  <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="col-span-3" placeholder="New password" />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={() => setCredentialsMutation.mutate({ clinicId: clinic.id, username: editUsername, password: editPassword })} disabled={!editUsername || !editPassword || setCredentialsMutation.isPending}>
                                  Update
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => archiveClinicMutation.mutate(clinic.id)}>
                            <Archive className="h-3 w-3 mr-1" /> Archive
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {archivedClinics.length > 0 && (
          <Card className="border-muted bg-muted/10">
            <CardHeader>
              <CardTitle className="flex items-center text-muted-foreground">
                <Archive className="h-5 w-5 mr-2" />
                Archived ({archivedClinics.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-muted/30">
                {archivedClinics.map(clinic => (
                  <div key={clinic.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-muted-foreground">{clinic.name}</h3>
                        <p className="text-xs text-muted-foreground/60">{clinic.address}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => unarchiveClinicMutation.mutate(clinic.id)}>
                        <ArchiveRestore className="h-3 w-3 mr-1" /> Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
