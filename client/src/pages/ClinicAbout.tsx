import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Building2, MapPin, Mail, Clock, ArrowLeft, Globe, Phone, Award, Activity, ExternalLink } from "lucide-react";
import type { Clinic } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

export default function ClinicAbout() {
  const params = new URLSearchParams(window.location.search);
  const clinicIdFromUrl = params.get("clinicId");

  const { data: clinics, isLoading } = useQuery<Clinic[]>({
    queryKey: ['/api/clinics'],
  });

  const hardcodedClinic: Clinic = {
    id: 999,
    name: "Demo Smile Clinic",
    address: "123 Demo St, Dental City",
    username: "demo_clinic",
    passwordHash: "",
    email: "demo@example.com",
    isArchived: false,
    createdAt: new Date()
  };

  const allClinics = clinics 
    ? [...clinics.filter(c => !c.isArchived && c.name !== "Demo Smile Clinic"), hardcodedClinic]
    : [hardcodedClinic];

  const clinic = allClinics.find(c => c.id.toString() === clinicIdFromUrl);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Clinic Not Found</h1>
        <p className="text-muted-foreground mb-8">We couldn't find the clinic you're looking for.</p>
        <Link href="/book">
          <Button>Back to Booking</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-5xl">
        <div className="mb-10">
          <Link href={`/book${clinicIdFromUrl ? `?clinicId=${clinicIdFromUrl}` : ""}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-8 hover:bg-background/80" data-testid="button-back-to-booking">
              <ArrowLeft className="h-4 w-4" />
              Back to Booking
            </Button>
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 text-foreground">{clinic.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground ml-1">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-lg font-medium">Clinic Profile & Professional Care</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="hover-elevate transition-all border-none bg-background shadow-sm overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6 text-primary">
                <MapPin className="h-5 w-5" />
                <h2 className="text-xl font-bold text-foreground">Location</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {clinic.address || "Address not provided"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all border-none bg-background shadow-sm overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6 text-primary">
                <Mail className="h-5 w-5" />
                <h2 className="text-xl font-bold text-foreground">Contact Details</h2>
              </div>
              <div className="space-y-6">
                {clinic.phone && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1 font-bold uppercase tracking-wider">Phone</label>
                    <a href={`tel:${clinic.phone}`} className="font-semibold text-lg hover:text-primary transition-colors flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {clinic.phone}
                    </a>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-bold uppercase tracking-wider">Email</label>
                  <p className="font-semibold text-lg">{clinic.email || "Not available"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all border-none bg-background shadow-sm overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6 text-primary">
                <Globe className="h-5 w-5" />
                <h2 className="text-xl font-bold text-foreground">Digital Presence</h2>
              </div>
              {clinic.website ? (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-bold uppercase tracking-wider">Website</label>
                  <a 
                    href={clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary font-semibold text-lg hover:underline flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Website
                  </a>
                </div>
              ) : (
                <p className="text-muted-foreground">Website details coming soon</p>
              )}
            </CardContent>
          </Card>

          {(clinic.doctors && Array.isArray(clinic.doctors) && clinic.doctors.length > 0) ? (
            <Card className="md:col-span-3 border-none bg-background shadow-sm overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-8 text-primary">
                  <Award className="h-5 w-5" />
                  <h2 className="text-2xl font-bold text-foreground">Our Medical Experts</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {(clinic.doctors as {name: string, specialization: string, degree: string}[]).map((doc, idx) => (
                    <div key={idx} className="group p-6 rounded-2xl bg-muted/30 hover:bg-primary/5 transition-all duration-300">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{doc.name}</h3>
                      <p className="text-primary font-semibold mb-4 text-sm uppercase tracking-wide">{doc.specialization}</p>
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-background border border-primary/20 text-primary text-xs font-bold">
                        {doc.degree}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : clinic.doctorName ? (
            <Card className="md:col-span-3 border-none bg-background shadow-sm overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-8 text-primary">
                  <Award className="h-5 w-5" />
                  <h2 className="text-2xl font-bold text-foreground">Medical Lead</h2>
                </div>
                <div className="group p-6 rounded-2xl bg-muted/30 hover:bg-primary/5 transition-all duration-300">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{clinic.doctorName}</h3>
                  <p className="text-primary font-semibold mb-4 text-sm uppercase tracking-wide">{clinic.doctorSpecialization}</p>
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-background border border-primary/20 text-primary text-xs font-bold">
                    {clinic.doctorDegree}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="md:col-span-3 border-none bg-background shadow-sm overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-8 text-primary">
                <Clock className="h-5 w-5" />
                <h2 className="text-2xl font-bold text-foreground">Practice Hours</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-muted/30">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Weekdays</span>
                  <span className="text-lg font-bold">9:00 AM - 7:00 PM</span>
                </div>
                <div className="p-6 rounded-2xl bg-muted/30">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Saturdays</span>
                  <span className="text-lg font-bold">9:00 AM - 4:00 PM</span>
                </div>
                <div className="p-6 rounded-2xl bg-muted/30 border border-destructive/10">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sundays</span>
                  <span className="text-lg font-bold text-destructive">CLOSED</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 p-10 rounded-3xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            Clinic Philosophy
          </h3>
          <p className="text-muted-foreground leading-relaxed text-lg max-w-3xl">
            We are dedicated to providing the highest quality dental care in a comfortable and friendly environment. 
            Our team of specialists uses the latest technology to ensure your smile stays healthy and beautiful. 
            Detailed service lists and patient testimonials are being prepared and will be available soon.
          </p>
        </div>
      </div>
    </div>
  );
}
