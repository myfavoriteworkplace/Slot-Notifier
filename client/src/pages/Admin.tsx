import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2, MapPin, Key, Eye, EyeOff, Check } from "lucide-react";
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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
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
  const { toast } = useToast();

  const { data: clinics, isLoading: clinicsLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics', { includeArchived: true }],
    queryFn: async () => {
      const res = await fetch('/api/clinics?includeArchived=true', {
        credentials: 'include',
      });
      return res.json();
    },
  });

  const createClinicMutation = useMutation({
    mutationFn: async (data: { name: string; address: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setNewClinicName("");
      setNewClinicAddress("");
      setNewClinicUsername("");
      setNewClinicPassword("");
      toast({ title: "Clinic added successfully" });
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
      toast({ title: "Credentials updated successfully" });
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

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

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">Manage clinics and application settings</p>
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
