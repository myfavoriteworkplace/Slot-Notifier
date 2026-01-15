import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check, LogIn, FlaskConical } from "lucide-react";
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

  const { data: clinics, isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics', { includeArchived: true }],
    queryFn: async () => {
      const res = await fetch('/api/clinics?includeArchived=true', {
        credentials: 'include',
      });
      const serverClinics = await res.json();
      
      // Merge with localStorage clinics if demo super admin
      if (localStorage.getItem("demo_super_admin") === "true") {
        const demoClinicsRaw = localStorage.getItem("demo_clinics");
        if (demoClinicsRaw) {
          const demoClinics = JSON.parse(demoClinicsRaw);
          // Filter out any server clinics that might overlap if we're in demo mode
          return [...serverClinics, ...demoClinics];
        }
      } else if (adminEmail === "demo_super_admin@bookmyslot.com") {
        // Fallback for when the flag isn't set yet but we're logging in
        const demoClinicsRaw = localStorage.getItem("demo_clinics");
        if (demoClinicsRaw) {
          const demoClinics = JSON.parse(demoClinicsRaw);
          return [...serverClinics, ...demoClinics];
        }
      }
      return serverClinics;
    },
  });

  const createClinicMutation = useMutation({
    mutationFn: async (data: { name: string; address: string }) => {
      if (localStorage.getItem("demo_super_admin") === "true") {
        const newClinic: Clinic = {
          id: Math.floor(Math.random() * 10000) + 1000,
          name: data.name,
          email: null,
          address: data.address,
          isArchived: false,
          username: null,
          passwordHash: null,
          createdAt: new Date()
        };
        const demoClinicsRaw = localStorage.getItem("demo_clinics");
        const demoClinics = demoClinicsRaw ? JSON.parse(demoClinicsRaw) : [];
        demoClinics.push(newClinic);
        localStorage.setItem("demo_clinics", JSON.stringify(demoClinics));
        return newClinic;
      }
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
      // Re-fetch clinics immediately
      await queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setNewClinicName("");
      setNewClinicAddress("");
      setNewClinicUsername("");
      setNewClinicPassword("");
      toast({ title: "Clinic added successfully (Demo)" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add clinic", 
        description: error.message || "Only super users can add clinics",
        variant: "destructive" 
      });
    },
  });

  const setCredentialsMutation = useMutation({
    mutationFn: async (data: { clinicId: number; username: string; password: string }) => {
      if (localStorage.getItem("demo_super_admin") === "true") {
        const demoClinicsRaw = localStorage.getItem("demo_clinics");
        if (demoClinicsRaw) {
          const demoClinics = JSON.parse(demoClinicsRaw);
          const clinicIndex = demoClinics.findIndex((c: any) => c.id === data.clinicId);
          if (clinicIndex !== -1) {
            demoClinics[clinicIndex].username = data.username;
            // In a real app we'd hash the password, but for demo we just store the fact it has one
            demoClinics[clinicIndex].hasDemoPassword = true; 
            localStorage.setItem("demo_clinics", JSON.stringify(demoClinics));
            
            // Also store demo credentials specifically for login bypass
            const demoCredentialsRaw = localStorage.getItem("demo_clinic_credentials") || "{}";
            const demoCredentials = JSON.parse(demoCredentialsRaw);
            demoCredentials[data.username] = data.password;
            localStorage.setItem("demo_clinic_credentials", JSON.stringify(demoCredentials));
            
            return { ok: true };
          }
        }
      }
      return apiRequest('PATCH', `/api/clinics/${data.clinicId}/credentials`, {
        username: data.username,
        password: data.password,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setCredentialsDialogOpen(false);
      setSelectedClinic(null);
      setEditUsername("");
      setEditPassword("");
      toast({ title: "Credentials updated successfully (Demo)" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to set credentials", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const archiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      if (localStorage.getItem("demo_super_admin") === "true") {
        const demoClinicsRaw = localStorage.getItem("demo_clinics");
        if (demoClinicsRaw) {
          const demoClinics = JSON.parse(demoClinicsRaw);
          const clinicIndex = demoClinics.findIndex((c: any) => c.id === id);
          if (clinicIndex !== -1) {
            demoClinics[clinicIndex].isArchived = true;
            localStorage.setItem("demo_clinics", JSON.stringify(demoClinics));
            return { ok: true };
          }
        }
      }
      return apiRequest('PATCH', `/api/clinics/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic archived (Demo)" });
    },
    onError: () => {
      toast({ title: "Failed to archive clinic", variant: "destructive" });
    },
  });

  const unarchiveClinicMutation = useMutation({
    mutationFn: async (id: number) => {
      if (localStorage.getItem("demo_super_admin") === "true") {
        const demoClinicsRaw = localStorage.getItem("demo_clinics");
        if (demoClinicsRaw) {
          const demoClinics = JSON.parse(demoClinicsRaw);
          const clinicIndex = demoClinics.findIndex((c: any) => c.id === id);
          if (clinicIndex !== -1) {
            demoClinics[clinicIndex].isArchived = false;
            localStorage.setItem("demo_clinics", JSON.stringify(demoClinics));
            return { ok: true };
          }
        }
      }
      return apiRequest('PATCH', `/api/clinics/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      toast({ title: "Clinic restored (Demo)" });
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
    
    const isDemoSuperAdmin = adminEmail === "demo_super_admin@bookmyslot.com";
    
    if (isDemoSuperAdmin) {
      console.log("Demo super admin login detected, bypassing backend");
      localStorage.setItem("demo_super_admin", "true");
      try {
        await login({ email: adminEmail, password: "bypass" });
        toast({ title: "Login successful (Demo Bypass)" });
      } catch (err: any) {
        console.error("Demo bypass login error:", err);
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
            <p className="text-sm text-muted-foreground mb-4">
              If you are the first user and no superuser exists yet, you can claim superuser access.
            </p>
            <Button 
              onClick={() => claimSuperuserMutation.mutate()}
              disabled={claimSuperuserMutation.isPending}
              className="w-full"
              data-testid="button-claim-superuser"
            >
              {claimSuperuserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                'Claim Superuser Access'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeClinics = clinics?.filter(c => !c.isArchived) || [];
  const archivedClinics = clinics?.filter(c => c.isArchived) || [];

  const handleAddClinic = () => {
    if (!newClinicName.trim()) {
      toast({ title: "Please enter a clinic name", variant: "destructive" });
      return;
    }
    if (!newClinicUsername.trim() || !newClinicPassword.trim()) {
      toast({ title: "Please enter username and password", variant: "destructive" });
      return;
    }
    createClinicMutation.mutate({ 
      name: newClinicName.trim(), 
      address: newClinicAddress.trim() 
    });
  };

  const handleSetCredentials = () => {
    if (!selectedClinic) return;
    if (!editUsername.trim() || !editPassword.trim()) {
      toast({ title: "Please enter username and password", variant: "destructive" });
      return;
    }
    setCredentialsMutation.mutate({
      clinicId: selectedClinic.id,
      username: editUsername.trim(),
      password: editPassword.trim(),
    });
  };

  const openCredentialsDialog = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setEditUsername(clinic.username || "");
    setEditPassword("");
    setCredentialsDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Manage clinics and application settings</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Clinic
          </CardTitle>
          <CardDescription>
            Add clinic details and login credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">Clinic Name *</Label>
                <Input
                  id="clinic-name"
                  placeholder="e.g., Downtown Dental"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                  data-testid="input-clinic-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-address">Address</Label>
                <Input
                  id="clinic-address"
                  placeholder="e.g., 123 Main St"
                  value={newClinicAddress}
                  onChange={(e) => setNewClinicAddress(e.target.value)}
                  data-testid="input-clinic-address"
                />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Login Credentials</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-username">Username *</Label>
                  <Input
                    id="clinic-username"
                    placeholder="e.g., downtown_dental"
                    value={newClinicUsername}
                    onChange={(e) => setNewClinicUsername(e.target.value)}
                    data-testid="input-new-clinic-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="clinic-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={newClinicPassword}
                      onChange={(e) => setNewClinicPassword(e.target.value)}
                      data-testid="input-new-clinic-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleAddClinic}
              disabled={createClinicMutation.isPending || setCredentialsMutation.isPending}
              className="w-full md:w-auto"
              data-testid="button-add-clinic"
            >
              {(createClinicMutation.isPending || setCredentialsMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Clinic
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Active Clinics ({activeClinics.length})
          </CardTitle>
          <CardDescription>
            Clinics visible to customers in the booking dropdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clinicsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activeClinics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No active clinics. Add one above.
            </p>
          ) : (
            <div className="space-y-3">
              {activeClinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                  data-testid={`clinic-active-${clinic.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{clinic.name}</span>
                      {clinic.id >= 999 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-1">
                          <FlaskConical className="h-2.5 w-2.5" />
                          Demo
                        </Badge>
                      )}
                      {clinic.username ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Check className="h-3 w-3" />
                          Login enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No login
                        </Badge>
                      )}
                    </div>
                    {clinic.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {clinic.address}
                      </p>
                    )}
                    {clinic.username && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Username: <span className="font-mono">{clinic.username}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCredentialsDialog(clinic)}
                      data-testid={`button-credentials-${clinic.id}`}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      {clinic.username ? "Update" : "Set"} Login
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => archiveClinicMutation.mutate(clinic.id)}
                      disabled={archiveClinicMutation.isPending}
                      data-testid={`button-archive-${clinic.id}`}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {archivedClinics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archived Clinics ({archivedClinics.length})
            </CardTitle>
            <CardDescription>
              Clinics hidden from the booking dropdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {archivedClinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between p-3 border rounded-md bg-muted/50"
                  data-testid={`clinic-archived-${clinic.id}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-muted-foreground">{clinic.name}</span>
                      {clinic.id >= 999 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 gap-1 opacity-70">
                          <FlaskConical className="h-2.5 w-2.5" />
                          Demo
                        </Badge>
                      )}
                      <Badge variant="secondary">Archived</Badge>
                    </div>
                    {clinic.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {clinic.address}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unarchiveClinicMutation.mutate(clinic.id)}
                    disabled={unarchiveClinicMutation.isPending}
                    data-testid={`button-unarchive-${clinic.id}`}
                  >
                    <ArchiveRestore className="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedClinic?.username ? "Update" : "Set"} Login Credentials</DialogTitle>
            <DialogDescription>
              {selectedClinic?.username 
                ? `Update login credentials for ${selectedClinic?.name}`
                : `Set up login credentials for ${selectedClinic?.name} so they can access their dashboard`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                placeholder="Enter username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">
                {selectedClinic?.username ? "New Password" : "Password"}
              </Label>
              <Input
                id="edit-password"
                type="password"
                placeholder={selectedClinic?.username ? "Enter new password" : "Enter password"}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                data-testid="input-edit-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSetCredentials}
              disabled={setCredentialsMutation.isPending}
              data-testid="button-save-credentials"
            >
              {setCredentialsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
