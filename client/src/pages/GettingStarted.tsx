import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Building2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function GettingStarted() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to BookMySlot</h1>
        <p className="text-xl text-muted-foreground">
          Choose how you would like to get started with our platform today.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="hover-elevate transition-all duration-300 flex flex-col">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <CalendarPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Book a Slot</CardTitle>
            <p className="text-muted-foreground">
              Find a clinic and book your appointment in minutes. No registration required for patients.
            </p>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button 
              className="w-full gap-2 group" 
              size="lg"
              onClick={() => setLocation("/book")}
              data-testid="button-get-started-book"
            >
              Find Clinics
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all duration-300 flex flex-col border-dashed border-2">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-secondary-foreground" />
            </div>
            <CardTitle className="text-2xl">Register Clinic</CardTitle>
            <p className="text-muted-foreground">
              Manage your clinic's availability, doctors, and bookings. Join our network of healthcare providers.
            </p>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button 
              variant="outline" 
              className="w-full gap-2 group" 
              size="lg"
              onClick={() => setLocation("/clinic-login")}
              data-testid="button-get-started-register"
            >
              Start Registration
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>

          <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground">
          Already have a clinic account?{" "}
          <Button variant="ghost" className="p-0 h-9 px-2 underline hover:bg-transparent" onClick={() => setLocation("/clinic-login")}>
            Sign in here
          </Button>
        </p>
      </div>
    </div>
  );
}
