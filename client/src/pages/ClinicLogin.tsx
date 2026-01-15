import { useState } from "react";
import { useClinicAuth } from "@/hooks/use-clinic-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, ArrowLeft, Info, Copy, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function ClinicLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoggingIn, isAuthenticated } = useClinicAuth();
  const [_, setLocation] = useLocation();

  if (isAuthenticated) {
    setLocation("/clinic-dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Hardcoded demo login for demo purposes
    if (username === "demo_clinic" && password === "demo_password123") {
      console.log("Demo clinic login detected, bypassing backend for demo purposes");
      try {
        await login({ username, password });
      } catch (err) {
        console.error("Demo bypass login:", err);
      }
      setLocation("/clinic-dashboard");
      return;
    }

    try {
      await login({ username, password });
      setLocation("/clinic-dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Clinic Login</CardTitle>
            <CardDescription className="mt-2">
              Enter your clinic credentials to view your bookings
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                data-testid="input-clinic-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              disabled={isLoggingIn}
              data-testid="button-clinic-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

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
