import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Building2, MapPin, Mail, Clock, ArrowLeft } from "lucide-react";
import type { Clinic } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

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
    <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
      <div className="mb-8">
        <Link href={`/book?clinicId=${clinicIdFromUrl}`}>
          <Button variant="ghost" size="sm" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Booking
          </Button>
        </Link>
        
        <div className="flex items-center gap-4 mb-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{clinic.name}</h1>
        </div>
        <p className="text-muted-foreground text-lg ml-16">Clinic Profile & Information</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <MapPin className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-foreground">Location</h2>
          </div>
          <p className="text-foreground/80 leading-relaxed text-lg">
            {clinic.address || "Address not provided"}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <Mail className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-foreground">Contact Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1 font-medium uppercase">Email Address</label>
              <p className="font-medium text-lg">{clinic.email || "Not available"}</p>
            </div>
            {clinic.website && (
              <div className="pt-2">
                <label className="text-xs text-muted-foreground block mb-1 font-medium uppercase">Website</label>
                <a href={clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline cursor-pointer">
                  {clinic.website}
                </a>
              </div>
            )}
          </div>
        </div>

        {(clinic.doctors && Array.isArray(clinic.doctors) && clinic.doctors.length > 0) ? (
          <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm hover:border-primary/20 transition-all md:col-span-2">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Building2 className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-foreground">Our Medical Team</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {(clinic.doctors as {name: string, specialization: string, degree: string}[]).map((doc, idx) => (
                <div key={idx} className="flex flex-col border-l-2 border-primary/20 pl-4">
                  <h3 className="text-xl font-bold mb-1">{doc.name}</h3>
                  <p className="text-primary font-medium mb-2">{doc.specialization}</p>
                  <div className="inline-block self-start px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {doc.degree}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : clinic.doctorName ? (
          <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm hover:border-primary/20 transition-all md:col-span-2">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Building2 className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-foreground">Medical Lead</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-1">{clinic.doctorName}</h3>
                <p className="text-primary font-medium mb-4">{clinic.doctorSpecialization || "Specialist"}</p>
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {clinic.doctorDegree || "Professional Degree"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm hover:border-primary/20 transition-all md:col-span-2">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <Clock className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-foreground">Operating Hours</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <span className="font-medium">Monday - Friday</span>
              <span className="text-muted-foreground">9:00 AM - 7:00 PM</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <span className="font-medium">Saturday</span>
              <span className="text-muted-foreground">9:00 AM - 4:00 PM</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <span className="font-medium">Sunday</span>
              <span className="text-destructive font-medium uppercase text-sm">Closed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 p-8 rounded-2xl bg-primary/5 border border-dashed border-primary/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Coming Soon
        </h3>
        <p className="text-muted-foreground leading-relaxed">
          We are currently working on expanding this profile with doctor credentials, patient testimonials, 
          clinic gallery, and detailed service lists to help you make informed decisions about your dental care.
        </p>
      </div>
    </div>
  );
}
