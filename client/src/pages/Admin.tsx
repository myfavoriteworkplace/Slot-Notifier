import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Archive, ArchiveRestore, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Clinic } from "@shared/schema";

export default function Admin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [newClinicName, setNewClinicName] = useState("");
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
    mutationFn: async (name: string) => {
      return apiRequest('POST', '/api/clinics', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinics'] });
      setNewClinicName("");
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

  if (user?.role !== 'superuser') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only super users can access this page.</CardDescription>
          </CardHeader>
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
    createClinicMutation.mutate(newClinicName.trim());
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
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter clinic name"
              value={newClinicName}
              onChange={(e) => setNewClinicName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddClinic()}
              data-testid="input-clinic-name"
            />
            <Button 
              onClick={handleAddClinic}
              disabled={createClinicMutation.isPending}
              data-testid="button-add-clinic"
            >
              {createClinicMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
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
                  <span className="font-medium">{clinic.name}</span>
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">{clinic.name}</span>
                    <Badge variant="secondary">Archived</Badge>
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
    </div>
  );
}
