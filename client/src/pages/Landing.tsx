import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Check, Clock, Shield, Users } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const [_, setLocation] = useLocation();

  if (isAuthenticated) {
    if (user?.role === "owner") {
      setLocation("/dashboard");
    } else {
      setLocation("/book");
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="relative isolate pt-14 flex-1 flex flex-col justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-accent opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          />
        </div>

        <div className="py-24 sm:py-32 lg:pb-40">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-display font-bold tracking-tight text-foreground sm:text-6xl animate-fade-in-up">
                Booking made <span className="text-gradient">effortless</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground animate-fade-in-up delay-100">
                Streamline your scheduling process. Owners can easily manage availability, 
                and customers can book slots in seconds. No more back-and-forth emails.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6 animate-fade-in-up delay-200">
                <Button 
                  size="lg" 
                  className="rounded-full px-8 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                  onClick={() => window.location.href = "/api/login"}
                >
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" size="lg" className="rounded-full px-8">
                  Learn more
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
          <div className="mx-auto max-w-2xl lg:max-w-none">
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-3">
              {[
                {
                  name: 'Real-time Availability',
                  description: 'See open slots instantly. Updates happen in real-time so double bookings are impossible.',
                  icon: Clock,
                },
                {
                  name: 'Secure & Private',
                  description: 'Your data is protected. We prioritize security and privacy for both owners and customers.',
                  icon: Shield,
                },
                {
                  name: 'Role-based Access',
                  description: 'Tailored interfaces for business owners and their clients ensuring smooth workflows.',
                  icon: Users,
                },
              ].map((feature) => (
                <div key={feature.name} className="flex flex-col items-start bg-card p-8 rounded-2xl shadow-sm border hover:shadow-md transition-all">
                  <div className="rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                    <feature.icon aria-hidden="true" className="h-6 w-6 text-primary" />
                  </div>
                  <dt className="mt-4 font-semibold text-foreground">{feature.name}</dt>
                  <dd className="mt-2 leading-7 text-muted-foreground">{feature.description}</dd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
