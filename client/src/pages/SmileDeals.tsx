import { useQuery } from "@tanstack/react-query";
import { SmileDeal } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function SmileDeals() {
  const { data: deals = [], isLoading } = useQuery<SmileDeal[]>({
    queryKey: ['/api/smile-deals', { active: true }],
    queryFn: async () => {
      const res = await fetch('/api/smile-deals?active=true');
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Smile DEALS</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Exclusive dental offers and packages from our partner clinics. Book your appointment today and save!
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <Card key={deal.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
            <div className="aspect-video w-full relative">
              <img 
                src={deal.imageUrl} 
                alt={deal.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800";
                }}
              />
            </div>
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <CardTitle className="text-xl">{deal.title}</CardTitle>
                <span className="font-bold text-primary text-lg">₹{deal.price || "Deal"}</span>
              </div>
              <CardDescription className="line-clamp-2">{deal.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Link href={deal.bookingLink}>
                <Button className="w-full group">
                  Book Now
                  <ExternalLink className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
        {deals.length === 0 && (
          <div className="col-span-full text-center py-20 bg-muted/30 rounded-xl border-2 border-dashed">
            <p className="text-muted-foreground">No active deals at the moment. Check back soon!</p>
          </div>
        )}
      </div>

      <div className="mt-16 bg-primary/5 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <Sparkles className="h-6 w-6 mr-2 text-primary" />
            Partner with us?
          </h2>
          <p className="text-muted-foreground max-w-md">
            Are you a clinic owner? Register your clinic and list your special offers on Smile DEALS to reach more patients.
          </p>
        </div>
        <Link href="/register-clinic">
          <Button size="lg" className="whitespace-nowrap">
            Register Your Clinic
          </Button>
        </Link>
      </div>
    </div>
  );
}
