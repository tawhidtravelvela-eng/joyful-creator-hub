import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { getImage } from "@/utils/images";
import { Star, Clock, MapPin, Check, CalendarDays, Users, CheckCircle, Loader2, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Tour {
  id: string; name: string; destination: string; duration: string;
  price: number; category: string; rating: number; image: string | null;
  images?: string[];
  highlights: string[];
}

const itinerary = [
  { day: 1, title: "Arrival & Welcome", desc: "Airport pickup, hotel check-in, welcome dinner" },
  { day: 2, title: "City Highlights", desc: "Guided tour of major landmarks and attractions" },
  { day: 3, title: "Cultural Experience", desc: "Local markets, traditional cuisine, cultural shows" },
  { day: 4, title: "Adventure Day", desc: "Outdoor activities and scenic excursions" },
  { day: 5, title: "Departure", desc: "Leisure morning, airport transfer" },
];

const TourDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { formatPrice } = useCurrency();

  // Get images from navigation state if available
  const stateData = location.state as any;
  const stateImages: string[] = stateData?.images || [];

  useEffect(() => {
    supabase.from("tours").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) setTour({ ...data, highlights: Array.isArray((data as any).highlights) ? (data as any).highlights : [], images: stateImages } as any);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Layout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></Layout>;
  if (!tour) return <Layout><div className="container mx-auto px-4 py-20 text-center"><h2 className="text-2xl font-bold text-foreground">Tour not found</h2><Button className="mt-4" onClick={() => navigate("/tours")}>Back to Tours</Button></div></Layout>;

  // Build gallery images
  const allImages: string[] = [];
  if (tour.images && tour.images.length > 0) {
    allImages.push(...tour.images);
  } else if (tour.image) {
    allImages.push(getImage(tour.image));
  }
  if (allImages.length === 0) allImages.push(getImage(""));

  const heroImage = allImages[activeImageIndex] || allImages[0];
  const hasMultipleImages = allImages.length > 1;

  const prevImage = () => setActiveImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  const nextImage = () => setActiveImageIndex((prev) => (prev + 1) % allImages.length);

  return (
    <Layout>
      {/* Hero Image Gallery */}
      <div className="relative h-64 md:h-96 overflow-hidden bg-muted wl-detail" data-wl-surface="detail">
        <img src={heroImage} alt={tour.name} className="w-full h-full object-cover transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

        {hasMultipleImages && (
          <>
            <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full z-10">
              <ImageIcon className="w-3.5 h-3.5" />
              {activeImageIndex + 1} / {allImages.length}
            </div>
            {allImages.length <= 10 && (
              <div className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {allImages.map((_, i) => (
                  <button key={i} onClick={() => setActiveImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === activeImageIndex ? "bg-white w-4" : "bg-white/50 hover:bg-white/70"}`} />
                ))}
              </div>
            )}
          </>
        )}

        <div className="absolute bottom-6 left-0 container mx-auto px-4 z-10">
          <button onClick={() => navigate(-1)} className="text-primary-foreground/70 hover:text-primary-foreground text-sm mb-2 inline-block cursor-pointer">← Back to Tours</button>
          <h1 className="text-3xl font-bold text-primary-foreground">{tour.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant="secondary" className="bg-card/80"><MapPin className="w-3 h-3 mr-1" />{tour.destination}</Badge>
            <Badge variant="secondary" className="bg-card/80"><Clock className="w-3 h-3 mr-1" />{tour.duration}</Badge>
            <Badge variant="secondary" className="bg-card/80"><Star className="w-3 h-3 mr-1 fill-accent text-accent" />{tour.rating}</Badge>
            <Badge className="bg-primary text-primary-foreground">{tour.category}</Badge>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {hasMultipleImages && (
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allImages.slice(0, 8).map((img, i) => (
              <button key={i} onClick={() => setActiveImageIndex(i)}
                className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${i === activeImageIndex ? "ring-2 ring-primary opacity-100" : "opacity-60 hover:opacity-90"}`}>
                <img src={img} alt={`${tour.name} ${i + 1}`} className="h-16 w-24 md:h-20 md:w-32 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader><CardTitle>Tour Highlights</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tour.highlights.map((h) => (
                      <div key={h} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-sm text-foreground">{h}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader><CardTitle>Sample Itinerary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {itinerary.map((item) => (
                    <div key={item.day} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{item.day}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardHeader><CardTitle>What's Included</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {["Accommodation", "Daily breakfast", "Airport transfers", "Professional guide", "Entrance fees", "Travel insurance"].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sticky top-24 space-y-6">
              <Card>
                <CardHeader><CardTitle>Book This Tour</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <span className="text-3xl font-bold text-primary">{formatPrice(tour.price)}</span>
                    <span className="text-muted-foreground"> / person</span>
                  </div>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="w-4 h-4" /> {tour.duration}</div>
                    <div className="flex items-center gap-2 text-muted-foreground"><Users className="w-4 h-4" /> Max 15 travelers</div>
                    <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {tour.destination}</div>
                  </div>
                  <Button className="w-full" size="lg" onClick={() => navigate(`/tours/${tour.id}/book`)}>Book Now</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Have Questions?</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Send an inquiry to our team and we'll get back to you within 24 hours.</p>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/tours/${tour.id}/inquiry`)}>Send Inquiry</Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TourDetail;
