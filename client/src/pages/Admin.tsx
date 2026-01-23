import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check, LogIn, FlaskConical, LogOut, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

import { Switch } from "@/components/ui/switch";

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
  const [newClinicDoctors, setNewClinicDoctors] = useState<{ name: string; specialization: string; degree: string }[]>([]);
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
      doctors?: { name: string; specialization: string; degree: string }[];
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
          <Button variant="outline" size="sm" onClick={handleAdminLogout} className="h-9">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Clinics</CardTitle>
            <CardDescription>Current list of clinics</CardDescription>
          </CardHeader>
          <CardContent>
            {clinicsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {activeClinics.map(clinic => (
                  <div key={clinic.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">{clinic.name}</h3>
                      <p className="text-sm text-muted-foreground">{clinic.address}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => archiveClinicMutation.mutate(clinic.id)}>Archive</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
