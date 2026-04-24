import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { extractHotelNameSlug, buildHotelPath } from "@/utils/hotelSlug";
import { getImage } from "@/utils/images";
import { Star, MapPin, CheckCircle, Loader2, BedDouble, ChevronLeft, ChevronRight, Utensils, ImageIcon, ShieldCheck, XCircle, AlertTriangle, X, Sparkles, Heart, Clock, Users, Wifi, ParkingCircle, Coffee, Dumbbell, CalendarDays, Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { trackHotelInteraction } from "@/utils/hotelTracking";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { hydrateHotelDataFromWire } from "@/lib/hotelWireAdapter";

const HotelMap = lazy(() => import("@/components/hotels/HotelMap"));

interface Hotel {
  id: string;
  name: string;
  city: string;
  rating: number;
  reviews: number;
  price: number;
  image: string | null;
  amenities: string[];
  stars: number;
  source?: string;
  images?: string[];
  country?: string;
  propertyType?: string;
  availableRooms?: any[];
  searchId?: string;
  description?: string;
  address?: string;
  instructions?: any[];
  latitude?: number | null;
  longitude?: number | null;
}

const getRatingLabel = (rating: number): string => {
  if (rating >= 9) return "Exceptional";
  if (rating >= 8) return "Excellent";
  if (rating >= 7) return "Very Good";
  if (rating >= 6) return "Good";
  return "Pleasant";
};

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  wifi: Wifi, "free wifi": Wifi, "wi-fi": Wifi, parking: ParkingCircle,
  breakfast: Coffee, gym: Dumbbell, "fitness center": Dumbbell, pool: Dumbbell,
};

const getAmenityIcon = (amenity: string) => {
  const lower = amenity.toLowerCase();
  for (const [key, Icon] of Object.entries(AMENITY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return CheckCircle;
};

const HotelDetail = () => {
  const { id: rawId, slug, city } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { currency, formatDirectPrice } = useCurrency();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [roomError, setRoomError] = useState<string | null>(null);

  // ── Editable search params for direct-entry (no search context) ──
  const [editCheckin, setEditCheckin] = useState<Date | undefined>(undefined);
  const [editCheckout, setEditCheckout] = useState<Date | undefined>(undefined);
  const [editAdults, setEditAdults] = useState(2);
  const [editChildren, setEditChildren] = useState(0);
  const [editRooms, setEditRooms] = useState(1);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const openRoomLightbox = useCallback((images: string[], startIndex = 0) => {
    if (!images.length) return;
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  }, []);

  const nameSlug = slug ? extractHotelNameSlug(slug) : null;
  const stateData = location.state as any;
  const stateHotel = stateData?.hotel as Hotel | undefined;
  const id = stateHotel?.id || rawId?.replace(/^(tj-|hotelston-)/, "");
  const searchCheckin = stateData?.checkin || "";
  const searchCheckout = stateData?.checkout || "";
  const searchAdults = stateData?.adults || 1;
  const searchChildren = stateData?.children || 0;
  const searchRooms = stateData?.rooms || 1;

  const stateSource = stateHotel?.source || stateData?.source;
  const isNumericId = /^\d+$/.test(id || "");
  const isUuid = /^[0-9a-f]{8}-/.test(id || "");
  const hasSearchContext = !!(searchCheckin && searchCheckout);

  // ── Check Availability (manual date/guest picker) ──
  const checkAvailability = useCallback(async () => {
    if (!editCheckin || !editCheckout || !hotel) return;
    const checkin = format(editCheckin, "yyyy-MM-dd");
    const checkout = format(editCheckout, "yyyy-MM-dd");
    setAvailabilityLoading(true);
    setRoomError(null);

    const detailRooms: any[] = [];
    for (let i = 0; i < editRooms; i++) {
      const room: any = { adults: i === 0 ? editAdults : 2 };
      if (i === 0 && editChildren > 0) room.children = editChildren;
      detailRooms.push(room);
    }

    const hotelId = hotel.id || id;
    try {
      const { data, error } = await supabase.functions.invoke("unified-hotel-search", {
        body: {
          action: "detail", hid: String(hotelId),
          checkIn: checkin, checkOut: checkout,
          rooms: detailRooms, targetCurrency: currency,
        },
      });
      if (data) hydrateHotelDataFromWire(data);
      if (error || !data?.success || !data.hotel) {
        setRoomError(data?.error || error?.message || "No rooms available for the selected dates.");
        setAvailabilityLoading(false);
        return;
      }
      const detail = data.hotel;
      const hotelSearchId = detail.searchId || detail.id || hotel.searchId || "";
      const rooms = (detail.options || []).map((opt: any) => ({
        optionId: opt.optionId, optionType: opt.optionType || "SRSM", hotelSearchId,
        tjHotelId: detail.tjHotelId || hotelId, price: opt.price || 0, basePrice: opt.basePrice || 0,
        taxes: opt.taxes || 0, mf: opt.mf || 0, mft: opt.mft || 0, discount: opt.discount || 0,
        strikethrough: opt.strikethrough, mealBasis: opt.mealBasis || "Room Only",
        bookingNotes: opt.bookingNotes || "", inclusions: opt.inclusions || [],
        isRefundable: opt.isRefundable || false, cancellation: opt.cancellation || {},
        compliance: opt.compliance || {}, roomLeft: opt.roomLeft || 0,
        rooms: (opt.rooms || []).map((r: any) => ({
          id: r.id, name: r.name || "Room", standardName: r.standardName || "",
          images: r.images || [], facilities: r.facilities || [],
          roomDetails: r.roomDetails || {}, mealBasis: r.mealBasis || "",
        })),
        source: "tripjack",
      }));
      setHotel(prev => prev ? {
        ...prev, searchId: hotelSearchId || prev.searchId,
        images: detail.images?.length ? detail.images : prev.images,
        amenities: rooms[0]?.rooms?.[0]?.facilities || prev.amenities,
        description: detail.description || prev.description,
        address: detail.address || prev.address,
        instructions: detail.instructions || prev.instructions,
        availableRooms: rooms.length > 0 ? rooms : prev.availableRooms,
        price: rooms[0]?.price || prev.price,
      } : prev);
      setRoomError(rooms.length === 0 ? "No rooms available for the selected dates." : null);
    } catch (e: any) {
      setRoomError(e?.message || "Failed to check availability.");
    }
    setAvailabilityLoading(false);
  }, [editCheckin, editCheckout, editAdults, editChildren, editRooms, hotel, id, currency]);
  useEffect(() => {
    const source = stateSource || (stateHotel?.source);
    const isTripjack = source === "tripjack" || (isNumericId && !isUuid && !source);

    if (stateHotel) {
      setHotel(stateHotel);
      setLoading(false);

      trackHotelInteraction({
        hotelId: id || "",
        hotelName: stateHotel.name,
        hotelCity: stateHotel.city,
        hotelStars: stateHotel.stars,
        action: "view",
      });

      if (isTripjack && id && searchCheckin && searchCheckout) {
        setDetailLoading(true);
        setRoomError(null);
        const detailRooms = [];
        for (let i = 0; i < (searchRooms || 1); i++) {
          const room: any = { adults: i === 0 ? (searchAdults || 2) : 2 };
          if (i === 0 && searchChildren > 0) room.children = searchChildren;
          detailRooms.push(room);
        }
        supabase.functions.invoke("unified-hotel-search", {
          body: {
            action: "detail", searchId: stateHotel.searchId, hid: id,
            checkIn: searchCheckin, checkOut: searchCheckout, rooms: detailRooms, targetCurrency: currency,
          },
        }).then(({ data, error }) => {
          if (data) hydrateHotelDataFromWire(data);
          if (error || !data?.success || !data.hotel) {
            setRoomError(data?.error || error?.message || "No live room availability for the selected dates.");
            setDetailLoading(false);
            return;
          }
          const detail = data.hotel;
          const hotelSearchId = detail.searchId || detail.id || stateHotel.searchId || "";
          const rooms = (detail.options || []).map((opt: any) => ({
            optionId: opt.optionId, optionType: opt.optionType || "SRSM", hotelSearchId,
            tjHotelId: detail.tjHotelId || id, price: opt.price || 0, basePrice: opt.basePrice || 0,
            taxes: opt.taxes || 0, mf: opt.mf || 0, mft: opt.mft || 0, discount: opt.discount || 0,
            strikethrough: opt.strikethrough, mealBasis: opt.mealBasis || "Room Only",
            bookingNotes: opt.bookingNotes || "", inclusions: opt.inclusions || [],
            isRefundable: opt.isRefundable || false, cancellation: opt.cancellation || {},
            compliance: opt.compliance || {}, roomLeft: opt.roomLeft || 0,
            rooms: (opt.rooms || []).map((r: any) => ({
              id: r.id, name: r.name || "Room", standardName: r.standardName || "",
              images: r.images || [], facilities: r.facilities || [],
              roomDetails: r.roomDetails || {}, mealBasis: r.mealBasis || "",
            })),
            source: "tripjack",
          }));
          const roomImages: string[] = [];
          for (const opt of rooms) { for (const r of opt.rooms) { roomImages.push(...(r.images || [])); } }
          setHotel(prev => prev ? {
            ...prev, searchId: hotelSearchId || prev.searchId,
            images: detail.images?.length ? detail.images : [...(prev.images || []), ...roomImages.filter((img: string) => !(prev.images || []).includes(img))],
            amenities: rooms[0]?.rooms?.[0]?.facilities || prev.amenities,
            description: detail.description || prev.description,
            address: detail.address || prev.address,
            instructions: detail.instructions || prev.instructions,
            availableRooms: rooms.length > 0 ? rooms : prev.availableRooms,
          } : prev);
          setRoomError(null);
          setDetailLoading(false);
        });
      }
    } else if (nameSlug || (isNumericId && id)) {
      const query = nameSlug
        ? supabase.from("tripjack_hotels" as any).select("*").ilike("name", nameSlug.replace(/-/g, "%")).limit(1).maybeSingle()
        : supabase.from("tripjack_hotels" as any).select("*").eq("tj_hotel_id", Number(id)).maybeSingle();
      query.then(({ data }: any) => {
        if (data) {
          const images = (data.images || []).map((img: any) => img?.url || img).filter(Boolean);
          const dbHotel: Hotel = {
            id: String(data.tj_hotel_id), name: data.name || "", city: data.city_name || "",
            country: data.country_name || "", rating: data.rating || 0, reviews: 0, price: 0,
            image: data.hero_image_url || data.image_url || images[0] || null, images,
            amenities: Array.isArray(data.facilities) ? data.facilities.map((f: any) => f?.name || f).filter(Boolean).slice(0, 10) : [],
            stars: data.rating || 0, source: "tripjack", address: data.address || "",
            latitude: data.latitude, longitude: data.longitude,
            description: typeof data.description === "object" ? (data.description?.short || data.description?.overview || "") : (data.description || ""),
          };
          setHotel(dbHotel);
          setLoading(false);
          if (!slug && data.name && data.city_name) {
            const seoPath = buildHotelPath({ name: data.name, city: data.city_name });
            navigate(seoPath, { replace: true, state: location.state });
          }
          const checkin = searchCheckin || (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split("T")[0]; })();
          const checkout = searchCheckout || (() => { const d = new Date(); d.setDate(d.getDate() + 4); return d.toISOString().split("T")[0]; })();
          const detailRooms: any[] = [];
          for (let i = 0; i < (searchRooms || 1); i++) {
            const room: any = { adults: i === 0 ? (searchAdults || 2) : 2 };
            if (i === 0 && searchChildren > 0) room.children = searchChildren;
            detailRooms.push(room);
          }
          setDetailLoading(true);
          setRoomError(null);
          supabase.functions.invoke("unified-hotel-search", {
            body: { action: "detail", hid: String(data.tj_hotel_id), checkIn: checkin, checkOut: checkout, rooms: detailRooms, targetCurrency: currency },
          }).then(({ data: detailData, error: detailError }) => {
            if (detailData) hydrateHotelDataFromWire(detailData);
            if (detailError || !detailData?.success || !detailData.hotel) {
              setRoomError(detailData?.error || detailError?.message || "No live room availability.");
              setDetailLoading(false);
              return;
            }
            const detail = detailData.hotel;
            const hotelSearchId = detail.searchId || detail.id || "";
            const rooms = (detail.options || []).map((opt: any) => ({
              optionId: opt.optionId, optionType: opt.optionType || "SRSM", hotelSearchId,
              tjHotelId: detail.tjHotelId || id, price: opt.price || 0, basePrice: opt.basePrice || 0,
              taxes: opt.taxes || 0, mf: opt.mf || 0, mft: opt.mft || 0, discount: opt.discount || 0,
              strikethrough: opt.strikethrough, mealBasis: opt.mealBasis || "Room Only",
              bookingNotes: opt.bookingNotes || "", inclusions: opt.inclusions || [],
              isRefundable: opt.isRefundable || false, cancellation: opt.cancellation || {},
              compliance: opt.compliance || {}, roomLeft: opt.roomLeft || 0,
              rooms: (opt.rooms || []).map((r: any) => ({
                id: r.id, name: r.name || "Room", standardName: r.standardName || "",
                images: r.images || [], facilities: r.facilities || [],
                roomDetails: r.roomDetails || {}, mealBasis: r.mealBasis || "",
              })),
              source: "tripjack",
            }));
            setHotel(prev => prev ? {
              ...prev, searchId: hotelSearchId || prev.searchId,
              images: detail.images?.length ? detail.images : prev.images,
              amenities: rooms[0]?.rooms?.[0]?.facilities || prev.amenities,
              description: detail.description || prev.description,
              address: detail.address || prev.address,
              instructions: detail.instructions || prev.instructions,
              availableRooms: rooms.length > 0 ? rooms : prev.availableRooms,
              price: rooms[0]?.price || prev.price,
            } : prev);
            setRoomError(null);
            setDetailLoading(false);
          });
        } else { setLoading(false); }
      });
    } else if (isUuid && id) {
      supabase.from("hotels").select("*").eq("id", id).maybeSingle().then(({ data }) => {
        if (data) setHotel({ ...data, amenities: Array.isArray((data as any).amenities) ? (data as any).amenities : [] } as any);
        setLoading(false);
      });
    } else { setLoading(false); }
  }, [id, isNumericId, isUuid, stateHotel, stateSource, currency]);

  if (loading || detailLoading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BedDouble className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <motion.div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/30"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <motion.div key={i} className="w-24 h-16 rounded-xl bg-muted"
              animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-foreground font-medium text-base">{detailLoading ? "Fetching Room Availability" : "Loading Hotel"}</p>
          <p className="text-muted-foreground text-sm">{detailLoading ? "Checking rates & room options..." : "Loading hotel details..."}</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </div>
      </div>
    </Layout>
  );

  if (!hotel) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-foreground">Hotel not found</h2>
        <p className="text-muted-foreground mt-2">This hotel may no longer be available.</p>
        <Button className="mt-4" onClick={() => navigate("/hotels")}>Back to Hotels</Button>
      </div>
    </Layout>
  );

  const allImages: string[] = [];
  if (hotel.images && hotel.images.length > 0) allImages.push(...hotel.images);
  else if (hotel.image) allImages.push(hotel.source === "tripjack" ? hotel.image : getImage(hotel.image));
  if (allImages.length === 0) allImages.push(getImage(""));

  const heroImage = allImages[activeImageIndex] || allImages[0];
  const hasMultipleImages = allImages.length > 1;
  const prevImage = () => setActiveImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  const nextImage = () => setActiveImageIndex((prev) => (prev + 1) % allImages.length);

  const apiRooms = hotel.availableRooms || [];
  const hasApiRooms = apiRooms.length > 0;

  const handleBookRoom = (option: any, room?: any) => {
    const roomName = room?.name || option.rooms?.[0]?.name || "Room";
    const price = option.price || room?.price || hotel.price;
    const optionId = option.optionId || "";
    const hotelSearchId = option.hotelSearchId || hotel.searchId || "";
    const tjHotelId = option.tjHotelId || id || "";
    const bookPath = slug ? `/hotels/${city}/${slug}/book` : `/hotels/${id}/book`;
    navigate(bookPath, {
      state: {
        hotel: { id: hotel.id, name: hotel.name, city: hotel.city, country: hotel.country, price: hotel.price, source: hotel.source, stars: hotel.stars, searchId: hotelSearchId },
        optionId, hotelSearchId, searchId: hotelSearchId, tjHotelId, roomName, roomPrice: price,
        checkin: searchCheckin, checkout: searchCheckout, adults: searchAdults, children: searchChildren, rooms: searchRooms,
        isRefundable: option.isRefundable || false, isPanRequired: option.compliance?.panRequired || false,
        isPassportMandatory: option.compliance?.passportRequired || false,
        cancellation: option.cancellation || {}, roomDetails: option.rooms || [],
      },
    });
  };

  // Find best value room (cheapest refundable)
  const bestValueIdx = apiRooms.findIndex((r: any) => r.isRefundable && r.price > 0);

  return (
    <Layout>
      {/* Full-width Gallery Hero */}
      <div className="relative wl-detail" data-wl-surface="detail" data-wl-surface-hero="">
        {/* Main image */}
        <div className="relative h-72 md:h-[420px] overflow-hidden bg-muted">
          <img src={heroImage} alt={hotel.name} className="w-full h-full object-cover transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" />

          {hasMultipleImages && (
            <>
              <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
                <ImageIcon className="w-3.5 h-3.5" />
                {activeImageIndex + 1} / {allImages.length}
              </div>
            </>
          )}

          {/* Trust badges on hero */}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {apiRooms.some((r: any) => r.isRefundable) && (
              <div className="bg-[hsl(var(--success))]/90 backdrop-blur-sm text-[hsl(var(--success-foreground))] px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Free Cancellation
              </div>
            )}
          </div>

          {/* Hotel info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <div className="container mx-auto">
              <Link to="/hotels" className="text-white/70 hover:text-white text-sm mb-2 inline-flex items-center gap-1 transition-colors">
                <ChevronLeft className="w-3 h-3" /> Back to Hotels
              </Link>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{hotel.name}</h1>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {hotel.stars > 0 && (
                      <div className="flex items-center gap-0.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1">
                        {Array.from({ length: hotel.stars }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />)}
                      </div>
                    )}
                    <Badge className="bg-black/30 backdrop-blur-sm text-white border-0">
                      <MapPin className="w-3 h-3 mr-1" />{hotel.city}{hotel.country ? `, ${hotel.country}` : ""}
                    </Badge>
                  </div>
                </div>
                {/* Rating box */}
                {hotel.rating > 0 && (
                  <div className="hidden md:flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-white text-sm font-bold">{getRatingLabel(hotel.rating)}</p>
                        {hotel.reviews > 0 && <p className="text-white/60 text-xs">{hotel.reviews.toLocaleString()} reviews</p>}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-lg font-extrabold">{hotel.rating}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail strip */}
        {hasMultipleImages && (
          <div className="container mx-auto px-4 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {allImages.slice(0, 8).map((img, i) => (
                <button key={i} onClick={() => setActiveImageIndex(i)}
                  className={cn("flex-shrink-0 rounded-xl overflow-hidden transition-all", i === activeImageIndex ? "ring-2 ring-primary opacity-100" : "opacity-50 hover:opacity-80")}>
                  <img src={img} alt={`${hotel.name} ${i + 1}`} className="h-16 w-24 md:h-20 md:w-32 object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* AI Explanation Box */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border border-primary/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-foreground text-sm">Why this hotel is recommended</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hotel.rating >= 7 && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Strong guest ratings ({hotel.rating}/10)</span>
                  </div>
                )}
                {apiRooms.some((r: any) => r.isRefundable) && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Flexible cancellation available</span>
                  </div>
                )}
                {hotel.stars >= 4 && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Premium {hotel.stars}-star property</span>
                  </div>
                )}
                {hotel.amenities.length >= 4 && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>Excellent facilities & amenities</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Description */}
            {hotel.description && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                  <h2 className="text-xl font-bold text-foreground mb-3">About</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>
                </div>
              </motion.div>
            )}

            {/* Amenities Grid */}
            {hotel.amenities.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                  <h2 className="text-xl font-bold text-foreground mb-4">Amenities</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {hotel.amenities.map((a) => {
                      const Icon = getAmenityIcon(a);
                      return (
                        <div key={a} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40">
                          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground">{a}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Location Map */}
            {hotel.latitude && hotel.longitude && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                  <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" /> Location
                  </h2>
                  {hotel.address && <p className="text-sm text-muted-foreground mb-3">{typeof hotel.address === 'string' ? hotel.address : (() => { const a = hotel.address as any; const str = (v: any) => typeof v === 'string' ? v : v?.name || ''; return [a.adr, str(a.city), str(a.state), str(a.country), a.postalCode].filter(Boolean).join(', '); })()}</p>}
                  <Suspense fallback={<div className="h-[250px] bg-muted rounded-xl animate-pulse" />}>
                    <HotelMap hotels={[hotel]} singleMode className="h-[250px] rounded-xl overflow-hidden" />
                  </Suspense>
                </div>
              </motion.div>
            )}

            {/* Rooms Section */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <BedDouble className="w-5 h-5 text-primary" /> Available Rooms
                  </h2>
                  {detailLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                <div className="space-y-4">
                  {detailLoading && !hasApiRooms && (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Checking live availability...</span>
                    </div>
                  )}

                  {hasApiRooms ? (
                    (() => {
                      const grouped: Record<string, { roomName: string; roomImages: string[]; roomType?: string; bedInfo?: string; facilities?: string[]; options: any[] }> = {};
                      const extractImgUrl = (img: any): string => typeof img === 'string' ? img : img?.url || '';
                      const getBedKey = (room: any) => {
                        const beds = room?.roomDetails?.beds;
                        if (Array.isArray(beds) && beds.length > 0) return beds.map((b: any) => `${b.count || 1}${b.type || ''}`).sort().join('+');
                        const name = (room?.name || '').toLowerCase();
                        if (name.includes('twin')) return 'twin';
                        if (name.includes('double')) return 'double';
                        if (name.includes('king')) return 'king';
                        if (name.includes('queen')) return 'queen';
                        return '';
                      };
                      const getBedLabel = (room: any) => {
                        const beds = room?.roomDetails?.beds;
                        if (Array.isArray(beds) && beds.length > 0) return beds.map((b: any) => `${b.count > 1 ? b.count + '× ' : ''}${b.type}`).join(' + ');
                        return '';
                      };
                      for (const option of apiRooms) {
                        const rooms = option.rooms || [option];
                        const primaryRoom = rooms[0] || {};
                        const displayName = primaryRoom.name || primaryRoom.roomName || option.roomName || "Room";
                        const bedKey = getBedKey(primaryRoom);
                        const key = `${displayName.toLowerCase().replace(/\s+/g, ' ').trim()}|${bedKey}`;
                        if (!grouped[key]) {
                          const imgUrls = (primaryRoom.images || []).map(extractImgUrl).filter(Boolean);
                          grouped[key] = { roomName: displayName, roomImages: imgUrls, roomType: primaryRoom.standardName || primaryRoom.type, bedInfo: getBedLabel(primaryRoom), facilities: [...(primaryRoom.facilities || [])], options: [] };
                        }
                        const newImgUrls = (primaryRoom.images || []).map(extractImgUrl).filter((u: string) => u && !grouped[key].roomImages.includes(u));
                        grouped[key].roomImages.push(...newImgUrls);
                        const newFacs = (primaryRoom.facilities || []).filter((f: string) => !grouped[key].facilities!.includes(f));
                        grouped[key].facilities!.push(...newFacs);
                        grouped[key].options.push(option);
                      }

                      return Object.values(grouped).map((group, gi) => (
                        <div key={gi} className="border border-border/30 rounded-2xl overflow-hidden">
                          {/* Room header */}
                          <div className="bg-muted/30 px-5 py-4 flex items-start gap-4">
                            {group.roomImages.length > 0 ? (
                              <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => openRoomLightbox(group.roomImages, 0)}>
                                <img src={group.roomImages[0]} alt={group.roomName} className="w-28 h-20 object-cover rounded-xl transition-opacity group-hover:opacity-80" loading="lazy" />
                                {group.roomImages.length > 1 && (
                                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 rounded-md">1/{group.roomImages.length}</span>
                                )}
                              </div>
                            ) : (
                              <div className="w-28 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-foreground">{group.roomName}</h4>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                {group.roomType && <span className="text-xs text-muted-foreground">{group.roomType}</span>}
                                {group.bedInfo && <span className="text-xs text-muted-foreground flex items-center gap-1"><BedDouble className="w-3 h-3" />{group.bedInfo}</span>}
                              </div>
                              {group.facilities && group.facilities.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {group.facilities.slice(0, 5).map((f: string, fi: number) => (
                                    <span key={fi} className="text-[10px] bg-background border border-border/50 px-2 py-0.5 rounded-md text-muted-foreground">{f}</span>
                                  ))}
                                  {group.facilities.length > 5 && <span className="text-[10px] text-muted-foreground">+{group.facilities.length - 5}</span>}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Rate options */}
                          <div className="divide-y divide-border/30">
                            {(() => {
                              const seen = new Map<string, { option: any; price: number }>();
                              const normMeal = (m: string) => m.replace(/[_\s]+/g, ' ').trim().toUpperCase();
                              for (const option of group.options) {
                                const mealBasis = normMeal(option.rooms?.[0]?.mealBasis || option.mealBasis || "ROOM ONLY");
                                const isRefundable = option.isRefundable || false;
                                const key = `${mealBasis}|${isRefundable}`;
                                const price = option.price || 0;
                                const existing = seen.get(key);
                                if (!existing || price < existing.price) seen.set(key, { option, price });
                              }
                              return Array.from(seen.values()).map(({ option }, oi) => {
                                const totalPrice = option.price || 0;
                                const isRefundable = option.isRefundable || false;
                                const mealBasis = option.rooms?.[0]?.mealBasis || option.mealBasis || "";
                                const isBestValue = oi === 0 && isRefundable;
                                const roomsLeft = option.roomLeft || 0;

                                return (
                                  <div key={oi} className={cn("px-5 py-4 hover:bg-muted/10 transition-colors", isBestValue && "bg-primary/[0.02]")}>
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                        {/* Labels */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {isBestValue && (
                                            <Badge className="bg-primary text-primary-foreground text-[10px] py-0 px-1.5 gap-0.5">
                                              <Sparkles className="w-2.5 h-2.5" /> Best Value
                                            </Badge>
                                          )}
                                          {mealBasis && mealBasis !== "ROOM ONLY" ? (
                                            <Badge variant="outline" className="text-[hsl(var(--success))] border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 text-[10px] gap-1 py-0">
                                              <Utensils className="w-2.5 h-2.5" /> {mealBasis}
                                            </Badge>
                                          ) : (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Utensils className="w-3 h-3" /> Room Only
                                            </span>
                                          )}
                                          {isRefundable ? (
                                            <Badge variant="outline" className="text-[hsl(var(--success))] border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 text-[10px] gap-1 py-0">
                                              <ShieldCheck className="w-2.5 h-2.5" /> Free Cancellation
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5 text-[10px] gap-1 py-0">
                                              <AlertTriangle className="w-2.5 h-2.5" /> Non-refundable
                                            </Badge>
                                          )}
                                        </div>
                                        {roomsLeft > 0 && roomsLeft <= 3 && (
                                          <span className="text-[10px] text-destructive font-bold flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Only {roomsLeft} left
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                          <p className="text-lg font-extrabold text-foreground">
                                            {formatDirectPrice(Math.round(totalPrice))}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground">total</p>
                                        </div>
                                        <Button onClick={() => handleBookRoom(option)} className="rounded-xl px-5">
                                          Reserve
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      ));
                    })()
                  ) : !detailLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{roomError || "No room availability data."}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>

            {/* Policies */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                <h2 className="text-xl font-bold text-foreground mb-4">Hotel Policies</h2>
                <div className="space-y-3">
                  {hotel.instructions && hotel.instructions.length > 0 ? (
                    hotel.instructions.map((inst: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-[hsl(var(--success))] mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{typeof inst === "string" ? inst : inst.text || inst.value || JSON.stringify(inst)}</p>
                      </div>
                    ))
                  ) : (
                    ["Check-in: 3:00 PM | Check-out: 11:00 AM", "Free cancellation up to 48 hours before check-in", "Children under 12 stay free with existing bedding"].map((p) => (
                      <div key={p} className="flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-[hsl(var(--success))] mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{p}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sticky Price Sidebar */}
          <div>
            <div className="sticky top-24 space-y-4">
              <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                <div className="text-center py-3">
                  {hotel.price > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Starting from</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-extrabold text-foreground">{formatDirectPrice(Math.round(hotel.price))}</span>
                        <span className="text-muted-foreground text-sm">/ night</span>
                      </div>
                      {(hotel as any).totalPrice > 0 && (hotel as any).numNights > 1 && (
                        <p className="text-xs text-muted-foreground mt-1">{formatDirectPrice((hotel as any).totalPrice)} total · {(hotel as any).numNights} nights</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select dates for pricing</p>
                  )}
                </div>

                {/* Show static dates if came from search */}
                {hasSearchContext && (
                  <div className="bg-muted/40 rounded-xl p-3 mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in</span>
                      <span className="font-medium text-foreground">{searchCheckin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out</span>
                      <span className="font-medium text-foreground">{searchCheckout}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guests</span>
                      <span className="font-medium text-foreground">{searchAdults} Adult{searchAdults > 1 ? "s" : ""}{searchChildren > 0 ? `, ${searchChildren} Child${searchChildren > 1 ? "ren" : ""}` : ""}</span>
                    </div>
                    {searchRooms > 1 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rooms</span>
                        <span className="font-medium text-foreground">{searchRooms}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable date/guest picker when no search context */}
                {!hasSearchContext && (
                  <div className="mt-3 space-y-3">
                    {/* Check-in date */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Check-in</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 rounded-xl", !editCheckin && "text-muted-foreground")}>
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {editCheckin ? format(editCheckin, "MMM dd, yyyy") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editCheckin} onSelect={(d) => {
                            setEditCheckin(d);
                            if (d && (!editCheckout || editCheckout <= d)) setEditCheckout(addDays(d, 1));
                          }} disabled={(date) => date < new Date()} initialFocus className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Check-out date */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Check-out</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 rounded-xl", !editCheckout && "text-muted-foreground")}>
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {editCheckout ? format(editCheckout, "MMM dd, yyyy") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editCheckout} onSelect={setEditCheckout}
                            disabled={(date) => date <= (editCheckin || new Date())} initialFocus className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Guests & Rooms */}
                    <div className="bg-muted/40 rounded-xl p-3 space-y-2.5">
                      {/* Adults */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Adults</p>
                          <p className="text-[10px] text-muted-foreground">Age 18+</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditAdults(Math.max(1, editAdults - 1))} disabled={editAdults <= 1}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-bold w-5 text-center text-foreground">{editAdults}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditAdults(Math.min(9, editAdults + 1))} disabled={editAdults >= 9}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Children */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Children</p>
                          <p className="text-[10px] text-muted-foreground">Age 0–17</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditChildren(Math.max(0, editChildren - 1))} disabled={editChildren <= 0}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-bold w-5 text-center text-foreground">{editChildren}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditChildren(Math.min(6, editChildren + 1))} disabled={editChildren >= 6}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Rooms */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Rooms</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditRooms(Math.max(1, editRooms - 1))} disabled={editRooms <= 1}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-bold w-5 text-center text-foreground">{editRooms}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditRooms(Math.min(5, editRooms + 1))} disabled={editRooms >= 5}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Check Availability button */}
                    <Button className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/15"
                      onClick={checkAvailability}
                      disabled={!editCheckin || !editCheckout || availabilityLoading}>
                      {availabilityLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</>
                      ) : (
                        <><Search className="w-4 h-4 mr-2" /> Check Availability</>
                      )}
                    </Button>
                  </div>
                )}

                {hasSearchContext && hasApiRooms && (
                  <Button className="w-full mt-4 rounded-xl h-12 font-bold shadow-lg shadow-primary/15" size="lg" onClick={() => handleBookRoom(apiRooms[0])}>
                    Reserve Now
                  </Button>
                )}
                {!hasApiRooms && !detailLoading && !availabilityLoading && hasSearchContext && (
                  <p className="text-xs text-muted-foreground text-center mt-3">{roomError || "No rooms available for selected dates."}</p>
                )}
                {!hasSearchContext && !availabilityLoading && roomError && (
                  <p className="text-xs text-destructive text-center mt-2">{roomError}</p>
                )}
                {detailLoading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading rooms...
                  </div>
                )}

                {/* Trust indicators */}
                <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Best price guarantee</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    <span>Instant confirmation</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>24/7 customer support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none overflow-hidden [&>button]:hidden">
          <div className="relative flex flex-col items-center">
            <button onClick={() => setLightboxOpen(false)} className="absolute top-3 right-3 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="relative w-full flex items-center justify-center min-h-[300px] max-h-[70vh]">
              <img src={lightboxImages[lightboxIndex]} alt={`Room image ${lightboxIndex + 1}`} className="max-w-full max-h-[70vh] object-contain" />
              {lightboxImages.length > 1 && (
                <>
                  <button onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"><ChevronRight className="w-5 h-5" /></button>
                </>
              )}
            </div>
            {lightboxImages.length > 1 && (
              <>
                <div className="py-3 text-white/80 text-sm">{lightboxIndex + 1} / {lightboxImages.length}</div>
                <div className="flex gap-2 px-4 pb-4 overflow-x-auto max-w-full">
                  {lightboxImages.map((img, i) => (
                    <button key={i} onClick={() => setLightboxIndex(i)} className={cn("flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors", i === lightboxIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100")}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default HotelDetail;
