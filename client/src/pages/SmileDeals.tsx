import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Tag, Sparkles, Calendar } from "lucide-react";

const DEALS = [
  {
    id: 1,
    title: "Premium Dental Cleaning",
    description: "Get a comprehensive professional cleaning and check-up for a special price. Includes scaling and polishing.",
    image: "/ads/cleaning.jpg",
    price: "$79",
    originalPrice: "$150",
    tag: "Most Popular",
    link: "#"
  },
  {
    id: 2,
    title: "Braces Consultation",
    description: "Start your journey to a perfect smile with a free orthodontic consultation. Digital scan included.",
    image: "/ads/braces.jpg",
    price: "FREE",
    originalPrice: "$99",
    tag: "Limited Time",
    link: "#"
  },
  {
    id: 3,
    title: "Teeth Whitening Special",
    description: "Brighten your smile by up to 8 shades with our professional in-office whitening treatment.",
    image: "/ads/whitening.jpg",
    price: "$199",
    originalPrice: "$350",
    tag: "Best Value",
    link: "#"
  }
];

export default function SmileDeals() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Smile DEALS</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Exclusive dental care offers and discounts from our top-rated clinics.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Deals Grid */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {DEALS.map((deal) => (
              <Card key={deal.id} className="flex flex-col overflow-hidden hover-elevate transition-all duration-300">
                <div className="relative h-48 w-full overflow-hidden">
                  <img 
                    src={deal.image} 
                    alt={deal.title}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=800";
                    }}
                  />
                  <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                    {deal.tag}
                  </Badge>
                </div>
                <CardHeader className="flex-1">
                  <CardTitle className="text-xl">{deal.title}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {deal.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">{deal.price}</span>
                    <span className="text-sm text-muted-foreground line-through">{deal.originalPrice}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button className="w-full gap-2" asChild>
                    <a href={deal.link}>
                      Book Now <Calendar className="h-4 w-4" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar for Sponsored Content */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="p-1 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-border">
            <Card className="border-0 bg-background/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  Sponsored
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-center p-4 border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">
                    Your ad could be here!<br />
                    Contact us to partner.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Dental Insurance Partner</h4>
                  <p className="text-xs text-muted-foreground">
                    Save up to 40% on out-of-pocket costs with our partner plans.
                  </p>
                  <Button variant="ghost" className="p-0 h-auto text-xs gap-1">
                    Learn more <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-muted/50 border-none">
            <CardContent className="p-4">
              <p className="text-xs text-center text-muted-foreground">
                All offers are subject to clinical evaluation and availability. Terms and conditions apply.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
