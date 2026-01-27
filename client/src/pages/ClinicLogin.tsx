import { useState, useEffect } from "react";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, ArrowLeft, Info, Copy, Stethoscope } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function ClinicLogin() {
  const [clinicUsername, setClinicUsername] = useState("");
  const [clinicPassword, setClinicPassword] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("clinic");
  const { toast } = useToast();
  
  const { login: clinicLogin, isLoggingIn: isClinicLoggingIn, isAuthenticated: isClinicAuthenticated } = useClinicAuth();
  const { login: doctorLogin, isLoggingIn: isDoctorLoggingIn, isAuthenticated: isDoctorAuthenticated } = useDoctorAuth();
  const { isAuthenticated: isAdminAuthenticated } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (isClinicAuthenticated) {
      setLocation("/clinic-dashboard");
    }
  }, [isClinicAuthenticated, setLocation]);

  useEffect(() => {
    if (isDoctorAuthenticated) {
      setLocation("/doctor-dashboard");
    }
  }, [isDoctorAuthenticated, setLocation]);

  const handleClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await clinicLogin({ username: clinicUsername, password: clinicPassword });
      setLocation("/clinic-dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await doctorLogin({ email: doctorEmail, password: doctorPassword });
      setLocation("/doctor-dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {activeTab === "clinic" ? (
              <Building2 className="h-8 w-8 text-primary" />
            ) : (
              <Stethoscope className="h-8 w-8 text-primary" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {activeTab === "clinic" ? "Clinic Login" : "Doctor Login"}
            </CardTitle>
            <CardDescription className="mt-2">
              {activeTab === "clinic" 
                ? "Enter your clinic credentials to manage bookings"
                : "Enter your email and password to access your dashboard"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(""); }}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="clinic" data-testid="tab-clinic-login">
                <Building2 className="h-4 w-4 mr-2" />
                Clinic
              </TabsTrigger>
              <TabsTrigger value="doctor" data-testid="tab-doctor-login">
                <Stethoscope className="h-4 w-4 mr-2" />
                Doctor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clinic">
              <form onSubmit={handleClinicSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-username">Username</Label>
                  <Input
                    id="clinic-username"
                    type="text"
                    value={clinicUsername}
                    onChange={(e) => setClinicUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    data-testid="input-clinic-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-password">Password</Label>
                  <Input
                    id="clinic-password"
                    type="password"
                    value={clinicPassword}
                    onChange={(e) => setClinicPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    data-testid="input-clinic-password"
                  />
                </div>
                
                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg" data-testid="text-login-error">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isClinicLoggingIn}
                  data-testid="button-clinic-login"
                >
                  {isClinicLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : "Login"}
                </Button>
              </form>

              {isAdminAuthenticated && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    As an <strong className="text-foreground">Admin</strong>, you can access any clinic dashboard by simply entering its <strong className="text-foreground">Username</strong>. No password is required.
                  </p>
                </div>
              )}

              <div className="mt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-primary">
                      <Info className="h-4 w-4" />
                      <span>Demo Credentials</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 rounded-xl shadow-xl border-border/50">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Demo Account</h4>
                        <p className="text-sm text-muted-foreground">
                          Use these credentials to test the clinic dashboard.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Username</Label>
                          <div className="flex gap-2">
                            <Input 
                              readOnly 
                              value="demo_clinic" 
                              className="h-8 text-xs bg-muted"
                            />
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => {
                                navigator.clipboard.writeText("demo_clinic");
                                toast({ title: "Username copied" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Password</Label>
                          <div className="flex gap-2">
                            <Input 
                              readOnly 
                              value="demo_password123" 
                              className="h-8 text-xs bg-muted"
                              type="password"
                            />
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => {
                                navigator.clipboard.writeText("demo_password123");
                                toast({ title: "Password copied" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>

            <TabsContent value="doctor">
              <form onSubmit={handleDoctorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doctor-email">Email</Label>
                  <Input
                    id="doctor-email"
                    type="email"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    data-testid="input-doctor-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor-password">Password</Label>
                  <Input
                    id="doctor-password"
                    type="password"
                    value={doctorPassword}
                    onChange={(e) => setDoctorPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    data-testid="input-doctor-password"
                  />
                </div>
                
                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg" data-testid="text-login-error">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isDoctorLoggingIn}
                  data-testid="button-doctor-login"
                >
                  {isDoctorLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : "Login"}
                </Button>
              </form>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  Don't have an account? Contact your clinic administrator to receive an invitation email.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
