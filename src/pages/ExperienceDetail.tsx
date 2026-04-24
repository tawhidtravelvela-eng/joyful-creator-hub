import { useState, useEffect, useMemo, useCallback } from "react";
import TourSearchLoader from "@/components/tours/TourSearchLoader";
import HybridSearchLoader from "@/components/site/hybrid/HybridSearchLoader";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Clock, MapPin, Check, CalendarDays, Users, CheckCircle, Loader2, Shield, XCircle, ChevronLeft, ChevronRight, Minus, Plus, ImageIcon, AlertCircle, RefreshCw, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { saveBooking } from "@/utils/bookingService";
import { useTenant } from "@/hooks/useTenant";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { buildTourUrl, buildTourBookUrl } from "@/utils/tourSlug";
import { hydrateTourDataFromWire } from "@/lib/tourWireAdapter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const ExperienceDetail = () => {
  const { productCode: rawProductCode, slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [product, setProduct] = useState<any>(null);
  const { isHybrid } = useIsHybridSkin();
  const [loading, setLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [selectedOptionCode, setSelectedOptionCode] = useState<string>("");
  const { currency, formatDirectPrice } = useCurrency();
  const { tenant } = useTenant();
  const [resolvedProductCode, setResolvedProductCode] = useState<string | null>(rawProductCode || null);
  const productCode = resolvedProductCode;

  // Read pax/date from URL params (passed from tour search)
  const [travelDate, setTravelDate] = useState(searchParams.get("date") || "");
  const [paxCounts, setPaxCounts] = useState<Record<string, number>>({
    ADULT: Number(searchParams.get("adults")) || 2,
    CHILD: Number(searchParams.get("children")) || 0,
    INFANT: Number(searchParams.get("infants")) || 0,
    YOUTH: 0,
    SENIOR: 0,
  });

  // Convenience accessors
  const adults = paxCounts.ADULT;
  const children = paxCounts.CHILD;
  const infants = paxCounts.INFANT;
  const updatePax = (band: string, val: number) => {
    setPaxCounts(prev => ({ ...prev, [band]: val }));
    setAvailabilityData(null);
  };

  // Availability state
  const [availabilityData, setAvailabilityData] = useState<any>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Price verification state
  const [verifyingPrice, setVerifyingPrice] = useState(false);
  const [priceChangeDialog, setPriceChangeDialog] = useState<{
    open: boolean;
    currentTotal: number;
    previousTotal: number;
    differencePercent: number;
  }>({ open: false, currentTotal: 0, previousTotal: 0, differencePercent: 0 });

  // Resolve slug to productCode if accessed via /tours/:destination/:slug or legacy /tours/experience/:slug
  const isLikelySlug = (val: string) => /^[a-z0-9-]+$/.test(val) && val.includes("-") && !/^\d+P\d+/.test(val);

  useEffect(() => {
    // If rawProductCode looks like a Viator product code (e.g. "42771P153"), use it directly
    if (rawProductCode && !isLikelySlug(rawProductCode)) {
      setResolvedProductCode(rawProductCode);
      return;
    }
    // Otherwise treat it as a slug that needs resolution
    const slugToResolve = slug || rawProductCode;
    if (!slugToResolve) return;
    // Check for velaId in query params for deterministic resolution
    const velaId = searchParams.get("vid") || "";
    const resolve = async (attempt = 0) => {
      try {
        const { data } = await supabase.functions.invoke("unified-tour-search", {
          body: { action: "resolve-slug", slug: slugToResolve, velaId },
        });
        if (data) hydrateTourDataFromWire(data);
        if (data?.success) { setResolvedProductCode(data.productCode); }
        else { setError("Tour not found"); setLoading(false); }
      } catch {
        if (attempt < 2) { setTimeout(() => resolve(attempt + 1), 1000); return; }
        setError("Failed to resolve tour"); setLoading(false);
      }
    };
    resolve();
  }, [slug, rawProductCode]);

  useEffect(() => {
    if (!productCode) return;
    const fetchProduct = async (attempt = 0) => {
      try {
        const { data, error: err } = await supabase.functions.invoke("unified-tour-search", {
          body: { action: "product", productCode, targetCurrency: currency },
        });
        if (data) hydrateTourDataFromWire(data);
        if (err) throw err;
        if (data?.success) {
          setProduct(data.product);
          setLoading(false);
        } else {
          setError(data?.error || "Product not found");
          setLoading(false);
        }
      } catch (e: any) {
        if (attempt < 2) { setTimeout(() => fetchProduct(attempt + 1), 1000); return; }
        setError(e.message);
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productCode, currency]);

  // Only preload the hero image
  useEffect(() => {
    if (!product) return;
    const imageUrls = (product.images || []).map((img: any) => {
      const variants = img.variants || [];
      const sorted = [...variants].sort((a: any, b: any) => (a.width || 0) - (b.width || 0));
      const medium = sorted.find((v: any) => (v.width || 0) >= 720) || sorted[sorted.length - 1] || {};
      return medium.url || "";
    }).filter(Boolean);

    if (imageUrls.length === 0) {
      setImagesLoaded(true);
      return;
    }

    const heroImg = new window.Image();
    heroImg.onload = heroImg.onerror = () => setImagesLoaded(true);
    heroImg.src = imageUrls[0];
  }, [product]);

  // Per-band total price (computed before early returns for hooks rules)
  const ageBandsData: any[] = product?.ageBands || [];
  const productPricingType = product?.pricingType || "PER_PERSON";
  const productBasePrice = product?.price ?? 0;
  const BAND_META_HOOK: Record<string, { defaultMin: number; defaultMax: number }> = {
    INFANT: { defaultMin: 0, defaultMax: 5 },
    CHILD: { defaultMin: 0, defaultMax: 10 },
    YOUTH: { defaultMin: 0, defaultMax: 10 },
    ADULT: { defaultMin: 1, defaultMax: 15 },
    SENIOR: { defaultMin: 0, defaultMax: 10 },
  };
  const BAND_ORDER_HOOK = ["ADULT", "CHILD", "YOUTH", "INFANT", "SENIOR"];
  const supportedBandsHook = ageBandsData.length > 0
    ? BAND_ORDER_HOOK.filter(b => ageBandsData.some((ab: any) => ab.bandId === b))
    : ["ADULT", "CHILD", "INFANT"];
  const getBandPriceHook = (bandId: string): number | null => {
    const band = ageBandsData.find((ab: any) => ab.bandId === bandId);
    return band?.price ?? null;
  };
  // Determine effective base price: selected option price > product price
  const productOptions_hook: any[] = product?.productOptions || [];
  const effectiveOptionCode_hook = selectedOptionCode || (productOptions_hook.length > 0 ? productOptions_hook[0]?.productOptionCode : "");
  const selectedOption_hook = productOptions_hook.find((o: any) => o.productOptionCode === effectiveOptionCode_hook);
  const effectiveBasePrice = selectedOption_hook?.fromPrice ?? productBasePrice;

  const totalPrice = useMemo(() => {
    if (productPricingType === "PER_GROUP") return effectiveBasePrice;
    let total = 0;
    for (const bandId of supportedBandsHook) {
      const count = paxCounts[bandId] || 0;
      if (count === 0) continue;
      const bandPrice = getBandPriceHook(bandId);
      total += (bandPrice ?? effectiveBasePrice) * count;
    }
    return total;
  }, [paxCounts, ageBandsData, effectiveBasePrice, productPricingType]);

  // Loading state with interactive loader
  if (loading || (!imagesLoaded && !error)) return (
    <Layout>
      {isHybrid ? (
      <HybridSearchLoader
        variant="tours"
        title="Loading Experience"
        subtitle="Please wait while we fetch all the details for this tour."
        steps={[
          "Fetching tour details",
          "Loading images & gallery",
          "Checking availability & pricing",
          "Preparing booking options",
        ]}
        inline
      />
      ) : (
      <TourSearchLoader
        title="Loading Experience"
        subtitle="Please wait while we fetch all the details for this tour."
        steps={[
          "Fetching tour details…",
          "Loading images & gallery…",
          "Checking availability & pricing…",
          "Preparing booking options…",
        ]}
        inline
      />
      )}
    </Layout>
  );
  if (error || !product) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-foreground">{error || "Tour not found"}</h2>
        <Button className="mt-4" onClick={() => navigate(-1)}>Back to Tours</Button>
      </div>
    </Layout>
  );

  // All data is now pre-normalized from backend
  const images = (product.images || []).map((img: any) => {
    const variants = img.variants || [];
    const sorted = [...variants].sort((a: any, b: any) => (a.width || 0) - (b.width || 0));
    const medium = sorted.find((v: any) => (v.width || 0) >= 720) || sorted[sorted.length - 1] || {};
    return medium.url || "";
  }).filter(Boolean);

  const heroImage = images[0] || "";
  const productOptions: any[] = product.productOptions || [];
  const pricingType = product.pricingType || "PER_PERSON";
  const cancellation = product.cancellationPolicy || "";
  const inclusions: string[] = product.inclusions || [];
  const exclusions: string[] = product.exclusions || [];
  const tags: string[] = (product.tags || []).filter((t: string) => !/viator/i.test(t));
  const highlights: string[] = (product.highlights || []).filter((h: string) => !/viator/i.test(h));
  const itinerary = product.itinerary || {};
  const rawDuration = product.duration || "";
  // Smart duration formatting: "120 hours" → "5 Days", "3 hours" → "3 Hours"
  const duration = (() => {
    const hoursMatch = rawDuration.match(/^(\d+)\s*hours?$/i);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      if (hours >= 24) {
        const days = Math.round(hours / 24);
        return `${days} Day${days > 1 ? "s" : ""}`;
      }
      return `${hours} Hour${hours > 1 ? "s" : ""}`;
    }
    const minsMatch = rawDuration.match(/^(\d+)\s*min(ute)?s?$/i);
    if (minsMatch) {
      const mins = parseInt(minsMatch[1]);
      if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        return rem > 0 ? `${hrs}h ${rem}m` : `${hrs} Hour${hrs > 1 ? "s" : ""}`;
      }
      return `${mins} Minutes`;
    }
    return rawDuration;
  })();
  const destination = product.destination || "";
  const maxTravelers = product.maxTravelersPerBooking;
  const ageBands: any[] = product.ageBands || [];
  const logistics = product.logistics || {};

  // Auto-select first option
  const effectiveOptionCode = selectedOptionCode || (productOptions.length > 0 ? productOptions[0].productOptionCode : "");
  const selectedOption = productOptions.find((o: any) => o.productOptionCode === effectiveOptionCode);

  // Price from selected option or fallback to product price
  const price = selectedOption?.fromPrice ?? product.price ?? 0;

  // Build supported age bands with pricing
  const BAND_META: Record<string, { label: string; emoji: string; defaultMin: number; defaultMax: number }> = {
    INFANT: { label: "Infant", emoji: "👶", defaultMin: 0, defaultMax: 5 },
    CHILD: { label: "Child", emoji: "🧒", defaultMin: 0, defaultMax: 10 },
    YOUTH: { label: "Youth", emoji: "🧑", defaultMin: 0, defaultMax: 10 },
    ADULT: { label: "Adult", emoji: "🧑‍💼", defaultMin: 1, defaultMax: 15 },
    SENIOR: { label: "Senior", emoji: "👴", defaultMin: 0, defaultMax: 10 },
  };
  const BAND_ORDER = ["ADULT", "CHILD", "YOUTH", "INFANT", "SENIOR"];

  const supportedBands = ageBands.length > 0
    ? BAND_ORDER.filter(b => ageBands.some((ab: any) => ab.bandId === b))
    : ["ADULT", "CHILD", "INFANT"]; // fallback if no band data

  const getBandPrice = (bandId: string): number | null => {
    const band = ageBands.find((ab: any) => ab.bandId === bandId);
    return band?.price ?? null;
  };

  const getBandAgeRange = (bandId: string): string => {
    const band = ageBands.find((ab: any) => ab.bandId === bandId);
    if (!band) return "";
    const start = band.startAge ?? 0;
    const end = band.endAge ?? "∞";
    return `${start}–${end} yrs`;
  };

  const billableTravelers = supportedBands.reduce((sum, b) => sum + (paxCounts[b] || 0), 0);

  const nextImage = () => setCurrentImageIdx((prev) => (prev + 1) % Math.max(images.length, 1));
  const prevImage = () => setCurrentImageIdx((prev) => (prev - 1 + images.length) % Math.max(images.length, 1));

  // ── Request to Book (fallback when availability fails) ──
  const createRequestToBook = async (reason: string) => {
    const paxMix = supportedBandsHook
      .map(b => ({ ageBand: b, numberOfTravelers: paxCounts[b] || 0 }))
      .filter(p => p.numberOfTravelers > 0);

    const bookingData = {
      type: "Tour",
      title: product.title,
      subtitle: `${destination} • ${duration || "Tour"}`,
      details: [
        { label: "Destination", value: destination },
        ...(duration ? [{ label: "Duration", value: duration }] : []),
        { label: "Travel Date", value: travelDate },
        ...paxMix.map(p => ({ label: p.ageBand, value: String(p.numberOfTravelers) })),
        ...(effectiveOptionCode ? [{ label: "Tour Option", value: selectedOption?.description || effectiveOptionCode }] : []),
      ],
      total: totalPrice,
      bookingId: `VT-${Date.now().toString(36).toUpperCase()}`,
      confirmationData: {
        api_source: "experience",
        product_code: productCode,
        product_title: product.title,
        product_option: effectiveOptionCode || null,
        travel_date: travelDate,
        pax_counts: paxCounts,
        request_reason: reason,
        original_currency: currency,
        original_price: totalPrice,
        display_currency: currency,
        display_total: totalPrice,
        hero_image: heroImage,
      },
      ...(tenant?.id ? { tenantId: tenant.id } : {}),
    };

    const dbId = await saveBooking(bookingData, "Request to Book");
    if (dbId) {
      // Notify admin in background
      supabase.functions.invoke("unified-tour-search", {
        body: { action: "notify-request-to-book", bookingId: bookingData.bookingId, productCode, reason, travelDate, totalPrice },
      }).catch(() => {});
      toast.info("Booking request submitted! Our team will confirm availability and contact you shortly.");
      navigate("/booking/confirmation", {
        state: { ...bookingData, paymentStatus: "Request to Book", dbId },
      });
    } else {
      toast.error("Failed to save booking request. Please try again.");
    }
  };

  // ── Book Now handler: availability-first flow ──
  const handleBookNow = async () => {
    if (!travelDate) {
      toast.error("Please select a travel date first");
      return;
    }
    if (billableTravelers === 0) {
      toast.error("Please add at least one traveler");
      return;
    }

    setVerifyingPrice(true);
    try {
      const paxMix: { ageBand: string; numberOfTravelers: number }[] = [];
      for (const bandId of supportedBandsHook) {
        const count = paxCounts[bandId] || 0;
        if (count > 0) paxMix.push({ ageBand: bandId, numberOfTravelers: count });
      }

      // Step 1: Check availability
      const { data, error: err } = await supabase.functions.invoke("unified-tour-search", {
        body: {
          action: "availability",
          productCode,
          productOptionCode: effectiveOptionCode || undefined,
          travelDate,
          paxMix,
          currency,
        },
      });
      if (data) hydrateTourDataFromWire(data);

      if (err) throw err;

      if (data?.success) {
        const avail = data.availability;
        const bookableItems = avail?.bookableItems || [];

        if (bookableItems.length > 0) {
          // Available! Extract live price
          const matchItem = effectiveOptionCode
            ? bookableItems.find((b: any) => b.productOptionCode === effectiveOptionCode)
            : bookableItems[0];
          const item = matchItem || bookableItems[0];

          let liveTotal = 0;
          if (item?.lineItems) {
            liveTotal = item.lineItems.reduce((sum: number, li: any) => {
              return sum + (li.subtotalPrice?.price?.recommendedRetailPrice || li.subtotalPrice?.price?.partnerTotalPrice || 0);
            }, 0);
          } else if (item?.totalPrice?.price?.recommendedRetailPrice) {
            liveTotal = item.totalPrice.price.recommendedRetailPrice;
          }

          // Convert currency if needed
          const liveCurrency = avail.currency || "USD";
          let convertedTotal = liveTotal;
          if (liveCurrency !== currency && liveTotal > 0) {
            // Use verify-price for proper conversion
            const { data: verifyData } = await supabase.functions.invoke("unified-tour-search", {
              body: { action: "verify-price", productCode, productOptionCode: effectiveOptionCode || undefined, travelDate, paxMix, expectedTotal: totalPrice, currency },
            });
            if (verifyData) hydrateTourDataFromWire(verifyData);
            if (verifyData?.success && verifyData.currentTotal > 0) {
              convertedTotal = verifyData.currentTotal;
            }
          }

          const finalLiveTotal = convertedTotal > 0 ? convertedTotal : totalPrice;
          const priceDiff = totalPrice > 0 ? (finalLiveTotal - totalPrice) / totalPrice : 0;

          if (priceDiff <= 0.05) {
            // ≤5% increase: accept silently
            const userFacingTotal = totalPrice; // Don't change what user sees
            const actualTotal = finalLiveTotal; // What we record in DB

            // Update DB price in background if changed
            if (Math.abs(priceDiff) > 0.001 && finalLiveTotal > 0) {
              console.log(`[booking] Price adjusted silently: ${totalPrice} → ${finalLiveTotal} (${(priceDiff * 100).toFixed(1)}%)`);
            }

            navigate(`${buildTourUrl({ title: product.title, destination: product.destination?.name, productCode, slug: product.slug })}/book`, {
              state: {
                product: { ...product, price: product.price },
                paxCounts, selectedOptionCode: effectiveOptionCode,
                travelDate, adults, children, infants,
                totalPrice: userFacingTotal,
                actualTotal,
                availabilityConfirmed: true,
                bookingRef: item.bookingRef || null,
              },
            });
            return;
          } else {
            // >5% increase: show price change dialog
            setPriceChangeDialog({
              open: true,
              currentTotal: finalLiveTotal,
              previousTotal: totalPrice,
              differencePercent: Math.round(Math.abs(priceDiff) * 100),
            });
            return;
          }
        }
      }

      // No bookable items or availability check returned no data
      await createRequestToBook("No availability for selected date and travelers");
    } catch (e: any) {
      console.warn("Availability check failed:", e);
      // API error → Request to Book
      await createRequestToBook(`Availability check failed: ${e.message || "Service temporarily unavailable"}`);
    } finally {
      setVerifyingPrice(false);
    }
  };

  const BookNowButton = ({ className = "" }: { className?: string }) => (
    <Button className={`w-full gap-2 ${className}`} size="lg" disabled={verifyingPrice} onClick={handleBookNow}>
      {verifyingPrice ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking Availability...</> : "Book Now"}
    </Button>
  );

  return (
    <Layout>
      {/* Hero Image Carousel */}
      <div className="relative h-72 md:h-96 overflow-hidden bg-muted wl-detail" data-wl-surface="detail">
        {images.length > 0 ? (
          <img src={images[currentImageIdx]} alt={`${product.title} - ${currentImageIdx + 1}`} className="w-full h-full object-cover transition-opacity duration-300" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center"><MapPin className="w-12 h-12 text-muted-foreground" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {images.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {images.length > 1 && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
            <ImageIcon className="w-3.5 h-3.5" />
            {currentImageIdx + 1} / {images.length}
          </div>
        )}

        {images.length > 1 && images.length <= 10 && (
          <div className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentImageIdx(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIdx ? "bg-white w-4" : "bg-white/50 hover:bg-white/70"}`} />
            ))}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="container mx-auto">
            <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white text-sm mb-2 inline-flex items-center gap-1 transition-colors cursor-pointer">
              <ChevronLeft className="w-3 h-3" /> Back to Tours
            </button>
            <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{product.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {destination && <Badge className="bg-black/30 backdrop-blur-sm text-white border-0 hover:bg-black/40"><MapPin className="w-3 h-3 mr-1" />{destination}</Badge>}
              {duration && <Badge className="bg-black/30 backdrop-blur-sm text-white border-0 hover:bg-black/40"><Clock className="w-3 h-3 mr-1" />{duration}</Badge>}
              {pricingType === "PER_GROUP" && <Badge className="bg-black/30 backdrop-blur-sm text-white border-0 hover:bg-black/40"><Users className="w-3 h-3 mr-1" />Per Group</Badge>}
              {maxTravelers && <Badge className="bg-black/30 backdrop-blur-sm text-white border-0 hover:bg-black/40"><Users className="w-3 h-3 mr-1" />Max {maxTravelers}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.slice(0, 8).map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIdx(i)}
                className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${i === currentImageIdx ? "ring-2 ring-primary opacity-100" : "opacity-60 hover:opacity-90"}`}
              >
                <img src={img} alt={`${product.title} ${i + 1}`} className="h-16 w-24 md:h-20 md:w-32 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader><CardTitle>About This Tour</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card>
                  <CardHeader><CardTitle>Highlights</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {highlights.map((h: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card>
                  <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Inclusions & Exclusions */}
            {(inclusions.length > 0 || exclusions.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader><CardTitle>What's Included</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {inclusions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-foreground">Included</h4>
                          {inclusions.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-success0 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {exclusions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-foreground">Not Included</h4>
                          {exclusions.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Itinerary */}
            {itinerary.itineraryType === "STANDARD" && itinerary.itineraryItems?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader><CardTitle>Itinerary</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {itinerary.itineraryItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary">{idx + 1}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{item.pointOfInterestLocation?.location?.name || `Stop ${idx + 1}`}</p>
                          <p className="text-sm text-muted-foreground">{item.description || ""}</p>
                          {item.duration?.fixedDurationInMinutes && (
                            <p className="text-xs text-muted-foreground mt-1">Duration: {item.duration.fixedDurationInMinutes} min</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Multi-day itinerary */}
            {itinerary.itineraryType === "MULTI_DAY_TOUR" && itinerary.days?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader><CardTitle>Day-by-Day Itinerary</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    {itinerary.days.map((day: any) => (
                      <div key={day.dayNumber} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">{day.dayNumber}</span>
                          </div>
                          <h4 className="font-semibold text-foreground">{day.title}</h4>
                        </div>
                        {day.items?.map((item: any, idx: number) => (
                          <p key={idx} className="text-sm text-muted-foreground ml-[52px]">{item.description}</p>
                        ))}
                        {day.accommodations?.map((acc: any, idx: number) => (
                          <p key={idx} className="text-xs text-muted-foreground ml-[52px] italic">🏨 {acc.description}</p>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Unstructured itinerary */}
            {itinerary.itineraryType === "UNSTRUCTURED" && (itinerary.unstructuredDescription || itinerary.unstructuredItinerary) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader><CardTitle>What to Expect</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {itinerary.unstructuredItinerary || itinerary.unstructuredDescription}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sticky top-24 space-y-6">
              <Card>
                <CardHeader><CardTitle>Book This Tour</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <span className="text-xs text-muted-foreground">From</span>
                    <div>
                      <span className="text-3xl font-bold text-primary">{formatDirectPrice(price)}</span>
                      <span className="text-muted-foreground"> / {pricingType === "PER_GROUP" ? "group" : "person"}</span>
                    </div>
                  </div>

                  {/* Product Options */}
                  {productOptions.length > 1 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="text-sm font-semibold text-foreground">Select Option</h4>
                      {productOptions.map((opt: any) => {
                        const isSelected = opt.productOptionCode === effectiveOptionCode;
                        const optPrice = opt.fromPrice ?? product.price ?? 0;
                        const optTitle = opt.title || opt.productOptionCode;
                        const optDesc = opt.description || "";
                        const guides = opt.languageGuides || [];
                        return (
                          <button
                            key={opt.productOptionCode}
                            onClick={() => setSelectedOptionCode(opt.productOptionCode)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-foreground">{optTitle}</span>
                                {optDesc && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: optDesc.replace(/<br\s*\/?>/gi, ' · ') }} />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                                {formatDirectPrice(optPrice)}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="mt-2 space-y-1.5">
                                {guides.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    🗣 Languages: {guides.map((g: any) => g.language || g).join(", ")}
                                  </p>
                                )}
                                {pricingType === "PER_GROUP" && (
                                  <p className="text-xs text-muted-foreground">💰 Price is per group</p>
                                )}
                                {pricingType === "PER_PERSON" && (
                                  <p className="text-xs text-muted-foreground">💰 Price is per person</p>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground">
                    {duration && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {duration}</span>}
                    {destination && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {destination}</span>}
                    {maxTravelers && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Max {maxTravelers}</span>}
                  </div>

                  <div className="space-y-3 mb-3">
                    {/* Travel Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" /> Travel Date
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "w-full border border-border rounded-xl px-4 py-2.5 bg-background text-sm text-left outline-none transition-all hover:border-primary/30 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 flex items-center justify-between gap-2",
                              travelDate ? "text-foreground font-medium" : "text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-primary/60" />
                              {travelDate ? format(parseISO(travelDate), "EEE, dd MMM yyyy") : "Select travel date"}
                            </div>
                            {travelDate && (
                              <span className="text-[10px] text-primary/70 font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                                {Math.ceil((parseISO(travelDate).getTime() - Date.now()) / 86400000)} days away
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
                          <Calendar
                            mode="single"
                            selected={travelDate ? parseISO(travelDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setTravelDate(format(date, "yyyy-MM-dd"));
                                setAvailabilityData(null);
                                setAvailabilityError(null);
                              }
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Travelers — compact grid */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Travelers</h4>
                      <div className={`grid gap-2 ${supportedBands.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {supportedBands.map((bandId) => {
                          const meta = BAND_META[bandId];
                          const bandPrice = getBandPrice(bandId);
                          const ageRange = getBandAgeRange(bandId);
                          const count = paxCounts[bandId] || 0;
                          const min = meta.defaultMin;
                          const max = ageBands.find((ab: any) => ab.bandId === bandId)?.maxTravelersPerBooking ?? meta.defaultMax;
                          return (
                            <div key={bandId} className="bg-muted/40 rounded-xl p-2.5 text-center space-y-1">
                              <div className="text-xs font-medium text-foreground flex items-center justify-center gap-1">
                                <span>{meta.emoji}</span> {meta.label}
                              </div>
                              {ageRange && <p className="text-[9px] text-muted-foreground/60 leading-none">{ageRange}</p>}
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => updatePax(bandId, Math.max(min, count - 1))} className="w-6 h-6 rounded-md border border-border/60 flex items-center justify-center hover:bg-background transition-colors disabled:opacity-20 text-muted-foreground" disabled={count <= min}>
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold text-foreground">{count}</span>
                                <button onClick={() => updatePax(bandId, Math.min(max, count + 1))} className="w-6 h-6 rounded-md border border-border/60 flex items-center justify-center hover:bg-background transition-colors disabled:opacity-20 text-muted-foreground" disabled={count >= max}>
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              {bandPrice !== null && pricingType !== "PER_GROUP" && (
                                <p className="text-[9px] font-semibold text-primary/70 leading-none">
                                  {bandPrice === 0 ? "FREE" : formatDirectPrice(bandPrice)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Logistics (Pickup/Dropoff) */}
                  {(logistics.start || logistics.end || logistics.travelerPickup) && (
                    <div className="border-t border-border pt-3 mb-3 space-y-1.5">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Logistics</h4>
                      {logistics.travelerPickup?.pickupOptionType && (
                        <p className="text-xs text-muted-foreground">
                          📍 Pickup: {logistics.travelerPickup.pickupOptionType === "PICKUP_AND_MEET_UP" ? "Hotel pickup available" : logistics.travelerPickup.pickupOptionType === "MEET_EVERYONE_AT_START_POINT" ? "Meet at start point" : logistics.travelerPickup.pickupOptionType.replace(/_/g, " ").toLowerCase()}
                        </p>
                      )}
                      {logistics.travelerPickup?.additionalInfo && (
                        <p className="text-xs text-muted-foreground/70">{logistics.travelerPickup.additionalInfo}</p>
                      )}
                      {logistics.start?.[0]?.description && (
                        <p className="text-xs text-muted-foreground">🚩 Start: {logistics.start[0].description}</p>
                      )}
                      {logistics.end?.[0]?.description && (
                        <p className="text-xs text-muted-foreground">🏁 End: {logistics.end[0].description}</p>
                      )}
                    </div>
                  )}

                  {/* Per-band price breakdown */}
                  <div className="border-t border-border pt-3 mb-4 space-y-1.5">
                    {pricingType === "PER_GROUP" ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Group price</span>
                        <span className="font-semibold text-foreground">{formatDirectPrice(price)}</span>
                      </div>
                    ) : (
                      <>
                        {supportedBands.map((bandId) => {
                          const count = paxCounts[bandId] || 0;
                          if (count === 0) return null;
                          const bandPrice = getBandPrice(bandId) ?? price;
                          const meta = BAND_META[bandId];
                          return (
                            <div key={bandId} className="flex justify-between text-xs text-muted-foreground">
                              <span>{meta.label} × {count}</span>
                              <span className="font-medium text-foreground">
                                {bandPrice === 0 ? "FREE" : formatDirectPrice(bandPrice * count)}
                              </span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between text-sm pt-1 border-t border-dashed border-border/50">
                          <span className="font-semibold text-foreground">Total</span>
                          <span className="font-bold text-primary text-base">{formatDirectPrice(totalPrice)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Book Now — sticky at bottom on mobile */}
                  <div className="hidden lg:block">
                    <BookNowButton />
                    {!travelDate && (
                      <p className="text-[10px] text-muted-foreground/60 text-center mt-2">Select a date to check availability & book</p>
                    )}
                  </div>

                  {/* Price Change Alert Dialog */}
                  <AlertDialog open={priceChangeDialog.open} onOpenChange={(open) => setPriceChangeDialog(prev => ({ ...prev, open }))}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-warning0" />
                          Price Has Changed
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p>The price for this tour has changed since you last viewed it.</p>
                          <div className="bg-muted rounded-lg p-3 space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Previous price</span>
                              <span className="line-through text-muted-foreground">{formatDirectPrice(priceChangeDialog.previousTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold">
                              <span className="text-foreground">Current price</span>
                              <span className="text-primary">{formatDirectPrice(priceChangeDialog.currentTotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Difference</span>
                              <span className={priceChangeDialog.currentTotal > priceChangeDialog.previousTotal ? "text-destructive" : "text-success"}>
                                {priceChangeDialog.currentTotal > priceChangeDialog.previousTotal ? "+" : "-"}{priceChangeDialog.differencePercent}%
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Would you like to proceed with the updated price?</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                          navigate(`${buildTourUrl({ title: product.title, destination: product.destination?.name, productCode, slug: product.slug })}/book`, {
                            state: {
                              product: { ...product, price: priceChangeDialog.currentTotal || product.price },
                              paxCounts, selectedOptionCode: effectiveOptionCode,
                              travelDate, adults, children, infants,
                              totalPrice: priceChangeDialog.currentTotal,
                            },
                          });
                        }}>
                          Proceed with {formatDirectPrice(priceChangeDialog.currentTotal)}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                
                </CardContent>
              </Card>

              {/* Cancellation Policy */}
              {cancellation && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Cancellation Policy</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{cancellation}</p>
                  </CardContent>
                </Card>
              )}

            </motion.div>
          </div>
        </div>
      </div>

      {/* Mobile sticky Book Now bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-xl border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-lg font-bold text-primary">{formatDirectPrice(totalPrice)}</span>
            <p className="text-[10px] text-muted-foreground truncate">
              {pricingType === "PER_GROUP" ? "per group" : `${billableTravelers} traveler${billableTravelers > 1 ? "s" : ""}`}
            </p>
          </div>
          <BookNowButton className="flex-shrink-0 w-auto px-6" />
        </div>
      </div>
      {/* Bottom spacer for mobile sticky bar */}
      <div className="h-20 lg:hidden" />
    </Layout>
  );
};

export default ExperienceDetail;
