import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { buildHotelPath } from "@/utils/hotelSlug";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, ShieldCheck, AlertTriangle, Utensils, Lock, Clock, CheckCircle, CreditCard, Phone } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { toast } from "sonner";
import { saveBooking, processBkashPayment, executeBkashPayment, updateBookingStatus } from "@/utils/bookingService";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTaxSettings } from "@/hooks/useTaxSettings";
import { useTenant } from "@/hooks/useTenant";
import { trackHotelInteraction } from "@/utils/hotelTracking";
import { useAuth } from "@/contexts/AuthContext";
import { hydrateHotelDataFromWire } from "@/lib/hotelWireAdapter";

interface Hotel {
  id: string; name: string; city: string; price: number; source?: string; country?: string; stars?: number; searchId?: string;
}

const HotelBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice, currency: displayCurrency } = useCurrency();
  const taxSettings = useTaxSettings();
  const { user } = useAuth();
  const { tenant } = useTenant();

  const stateData = location.state as any;
  const stateHotel = stateData?.hotel as Hotel | undefined;
  const source = stateData?.source || stateHotel?.source;
  const isTripjackSource = source === "tripjack" || /^\d+$/.test(id || "");
  const isApiHotel = isTripjackSource || source === "hotelston";

  const optionId = stateData?.optionId || "";
  const hotelSearchId = stateData?.hotelSearchId || stateData?.searchId || stateHotel?.searchId || "";
  const tjHotelId = stateData?.tjHotelId || id || "";
  const roomName = stateData?.roomName || "Room";
  const roomPrice = Number(stateData?.roomPrice) || 0;
  const paramCheckin = stateData?.checkin || "";
  const paramCheckout = stateData?.checkout || "";
  const paramAdults = Number(stateData?.adults) || 1;
  const paramChildren = Number(stateData?.children) || 0;
  const paramRooms = Number(stateData?.rooms) || 1;
  const isRefundable = stateData?.isRefundable || false;
  const isPanRequired = stateData?.isPanRequired || false;
  const isPassportMandatory = stateData?.isPassportMandatory || false;
  const roomDetails = stateData?.roomDetails || [];

  const [hotel, setHotel] = useState<Hotel | null>(stateHotel || null);
  const [pageLoading, setPageLoading] = useState(!stateHotel);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidated, setRevalidated] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const [priceDelta, setPriceDelta] = useState(0);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewPrice, setReviewPrice] = useState<number>(roomPrice);
  const [tjBookingId, setTjBookingId] = useState<string>("");

  useEffect(() => {
    if (!stateHotel && !isApiHotel) {
      supabase.from("hotels").select("id, name, city, price").eq("id", id).maybeSingle().then(({ data }) => {
        setHotel(data as any); setPageLoading(false);
      });
    } else if (!stateHotel && isApiHotel) {
      setHotel({ id: id || "", name: "Hotel", city: "", price: roomPrice, source: "tripjack" });
      setPageLoading(false);
    } else { setPageLoading(false); }
  }, [id, isApiHotel, isTripjackSource, stateHotel]);

  // Step 1: Revalidate price before review
  useEffect(() => {
    if (!isTripjackSource || !optionId || !tjHotelId) return;
    setRevalidating(true);
    supabase.functions.invoke("unified-hotel-search", {
      body: {
        action: "revalidate", hotelUid: tjHotelId, optionId,
        searchId: hotelSearchId, checkIn: paramCheckin, checkOut: paramCheckout,
        rooms: roomDetails.map((r: any) => ({ adults: paramAdults, children: paramChildren })),
        nationality: "106",
      },
    }).then(({ data, error }) => {
      if (data) hydrateHotelDataFromWire(data);
      setRevalidating(false);
      if (error || !data?.success) {
        if (data?.soldOut) {
          setReviewError("This room is no longer available.");
          setAlternatives(data?.alternatives || []);
          return;
        }
        // Non-fatal: proceed to review anyway
        console.warn("[revalidate] failed, proceeding to review:", data?.error || error?.message);
      } else {
        setRevalidated(true);
        if (data.priceChanged) {
          setPriceChanged(true);
          setPriceDelta(data.priceDelta || 0);
          setReviewPrice(data.price || roomPrice);
          toast.info(`Price updated: ${data.priceDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.priceDelta).toLocaleString()}`);
        }
        if (data.searchId) {
          // Use the fresh searchId for the review step
        }
      }

      // Step 2: Proceed to review
      if (!data?.soldOut && hotelSearchId) {
        setReviewLoading(true); setReviewError(null);
        supabase.functions.invoke("unified-hotel-search", {
          body: { action: "review", optionId, searchId: data?.searchId || hotelSearchId },
        }).then(({ data: revData, error: revError }) => {
          if (revData) hydrateHotelDataFromWire(revData);
          if (revError) { setReviewError("Failed to verify room availability"); setReviewLoading(false); return; }
          if (revData?.soldOut) { setReviewError("This room is no longer available."); setReviewLoading(false); return; }
          if (revData?.expired) { setReviewError("Search session expired. Please search again."); setReviewLoading(false); return; }
          if (!revData?.success) { setReviewError(revData?.error || "Price verification failed"); setReviewLoading(false); return; }
          setReviewData(revData);
          setTjBookingId(revData.bookingId || "");
          const reviewedOption = Array.isArray(revData.hotel?.options) ? revData.hotel.options[0] : revData.hotel?.option;
          if (reviewedOption?.price) setReviewPrice(reviewedOption.price);
          setReviewLoading(false);
        });
      }
    });
  }, [isTripjackSource, optionId, tjHotelId]);

  const calcNights = () => {
    if (paramCheckin && paramCheckout) {
      const diff = new Date(paramCheckout).getTime() - new Date(paramCheckin).getTime();
      const n = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return n > 0 ? n : 1;
    }
    return 1;
  };
  const nights = calcNights();

  const userFullName = user?.user_metadata?.full_name || "";
  const [firstName, ...lastParts] = userFullName.split(" ");
  const [form, setForm] = useState({
    firstName: firstName || "", lastName: lastParts.join(" ") || "", email: user?.email || "", phone: "",
    checkIn: paramCheckin, checkOut: paramCheckout, guests: String(paramAdults + paramChildren),
    specialRequests: "", panNumber: "", passportNumber: "", passportExpiry: "", nationality: "Indian",
  });
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("card");
  const { methods: paymentMethods } = usePaymentMethods();

  if (pageLoading) return <Layout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></Layout>;
  if (!hotel) return <Layout><div className="container mx-auto px-4 py-20 text-center"><h2 className="text-2xl font-bold">Hotel not found</h2></div></Layout>;

  const effectivePrice = reviewPrice || roomPrice;
  const subtotal = Math.round(effectivePrice);
  const convenienceFee = Math.round(subtotal * (taxSettings.convenienceFeePercentage / 100));
  const total = Math.round(subtotal + convenienceFee);
  const hotelSource = isApiHotel ? (hotel?.source || "tripjack") : undefined;
  const fmt = (price: number) => formatPrice(Math.round(price), hotelSource);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Please sign in to book"); navigate("/auth", { state: { returnTo: window.location.pathname + window.location.search } }); return; }
    if (!form.firstName || !form.lastName || !form.email) { toast.error("Please fill all required fields"); return; }
    if (isPanRequired && !form.panNumber) { toast.error("PAN number is required"); return; }
    if (isPassportMandatory && !form.passportNumber) { toast.error("Passport details are required"); return; }

    setLoading(true);
    trackHotelInteraction({ hotelId: hotel.id, hotelName: hotel.name, hotelCity: hotel.city, hotelStars: hotel.stars || 0, action: "book" });

    let tjConfirmation: any = null;
    if (isTripjackSource && tjBookingId) {
      try {
        const travellerInfo = roomDetails.map((room: any) => ({
          travellerInfo: [{ fN: form.firstName, lN: form.lastName, ti: "Mr", pt: "ADULT",
            ...(isPanRequired ? { pan: form.panNumber } : {}),
            ...(isPassportMandatory ? { pNum: form.passportNumber } : {}),
          }],
        }));
        const { data: bookResult, error: bookError } = await supabase.functions.invoke("unified-hotel-search", {
          body: { action: "book", bookingId: tjBookingId, roomTravellerInfo: travellerInfo,
            deliveryInfo: { emails: [form.email], contacts: form.phone ? [form.phone] : [], code: ["+91"] },
            paymentInfos: [{ amount: effectivePrice }],
          },
        });
        if (bookResult) hydrateHotelDataFromWire(bookResult);
        if (bookError || !bookResult?.success) { toast.error(bookResult?.error || "Booking failed."); setLoading(false); return; }
        tjConfirmation = bookResult;
      } catch { toast.error("Booking failed."); setLoading(false); return; }
    }

    const bookingData = {
      type: "Hotel", title: hotel.name, subtitle: `${roomName} • ${hotel.city}`,
      details: [
        { label: "Room", value: roomName }, { label: "Nights", value: `${nights}` },
        { label: "Rooms", value: `${paramRooms}` },
        { label: "Guests", value: `${paramAdults} Adult${paramAdults > 1 ? 's' : ''}${paramChildren > 0 ? `, ${paramChildren} Child` : ''}` },
        { label: "Guest Name", value: `${form.firstName} ${form.lastName}` },
        { label: "Email", value: form.email },
        ...(form.phone ? [{ label: "Phone", value: form.phone }] : []),
        ...(form.checkIn ? [{ label: "Check-in", value: form.checkIn }] : []),
        ...(form.checkOut ? [{ label: "Check-out", value: form.checkOut }] : []),
        ...(form.specialRequests ? [{ label: "Special Requests", value: form.specialRequests }] : []),
      ],
      total, bookingId: tjConfirmation?.bookingId || `HT-${Date.now().toString(36).toUpperCase()}`,
      confirmationData: {
        api_source: hotel.source || "local_inventory", original_currency: hotel.source === "tripjack" ? "INR" : displayCurrency,
        original_price: effectivePrice, display_currency: displayCurrency, display_total: total,
        tj_booking_id: tjBookingId || null, tj_confirmation: tjConfirmation || null,
        option_id: optionId || null, is_refundable: isRefundable,
      },
      tenantId: tenant?.id || null,
    };

    const dbId = await saveBooking(bookingData, tjConfirmation ? "Confirmed" : "Pending");
    if (!dbId) { toast.error("Failed to save booking."); setLoading(false); return; }

    const isBkash = selectedPayment === "bkash";
    if (isBkash && !tjConfirmation) {
      try {
        const bkResult = await processBkashPayment(total, bookingData.bookingId);
        if (!bkResult.success) { toast.error(bkResult.error || "bKash payment failed"); setLoading(false); return; }
        if (bkResult.bkashURL) {
          sessionStorage.setItem("bkash_paymentID", bkResult.paymentID || "");
          sessionStorage.setItem("bkash_id_token", bkResult.id_token || "");
          sessionStorage.setItem("bkash_booking_db_id", dbId);
          sessionStorage.setItem("bkash_booking_data", JSON.stringify(bookingData));
          window.location.href = bkResult.bkashURL; return;
        }
        if (bkResult.paymentID && bkResult.id_token) {
          const execResult = await executeBkashPayment(bkResult.paymentID, bkResult.id_token);
          if (execResult.success && execResult.transactionStatus === "Completed") {
            await updateBookingStatus(dbId, "Paid");
            toast.success(`bKash payment successful!`);
            navigate("/booking/confirmation", { state: { ...bookingData, bkashTrxID: execResult.trxID, paymentStatus: "Paid", dbId } });
          } else {
            navigate("/booking/confirmation", { state: { ...bookingData, paymentStatus: "Pending", dbId } });
          }
          return;
        }
      } catch { toast.error("bKash payment failed."); setLoading(false); return; }
    }

    navigate("/booking/confirmation", { state: { ...bookingData, paymentStatus: tjConfirmation ? "Confirmed" : "Pending", dbId } });
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Layout>
      {/* Confidence Bar */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-6 flex-wrap text-xs font-medium text-foreground">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>Secure booking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              <span>Instant confirmation</span>
            </div>
            {isRefundable && (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>Free cancellation</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span>24/7 support</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[hsl(222,55%,14%)] via-[hsl(222,50%,11%)] to-[hsl(222,45%,8%)] py-8">
        <div className="container mx-auto px-4">
          <Link to={buildHotelPath(hotel)} className="text-white/50 hover:text-white/80 text-sm mb-2 inline-block transition-colors">← Back to Hotel</Link>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>Complete Your Booking</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Review status */}
        {isTripjackSource && (
          <div className="mb-6 space-y-3">
            {revalidating && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-muted border border-border/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Revalidating live price...</span>
              </div>
            )}
            {reviewLoading && !revalidating && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-muted border border-border/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Verifying availability and price...</span>
              </div>
            )}
            {priceChanged && !reviewError && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Price {priceDelta > 0 ? 'increased' : 'decreased'} by {Math.abs(priceDelta).toLocaleString()} since you selected this room
                </span>
              </div>
            )}
            {reviewError && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{reviewError}</span>
              </div>
            )}
            {alternatives.length > 0 && (
              <div className="bg-card rounded-xl border border-border/30 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">Alternative rooms available:</p>
                <div className="space-y-2">
                  {alternatives.map((alt: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                      <div>
                        <p className="text-sm font-medium text-foreground">{alt.roomName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{alt.mealBasis}</span>
                          {alt.isRefundable && (
                            <span className="text-[10px] text-[hsl(var(--success))] font-medium">Free Cancel</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground">{fmt(alt.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {reviewData && !reviewError && !revalidating && !reviewLoading && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/20 text-[hsl(var(--success))]">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {revalidated ? 'Live price verified' : 'Price verified'} — room confirmed available
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {/* Guest Details */}
            <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
              <h2 className="text-lg font-bold text-foreground mb-4">Guest Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Name *</Label><Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required className="mt-1.5 rounded-xl" /></div>
                <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name *</Label><Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required className="mt-1.5 rounded-xl" /></div>
                <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email *</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required className="mt-1.5 rounded-xl" /></div>
                <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-1.5 rounded-xl" /></div>
              </div>

              {isPanRequired && (
                <div className="mt-4">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PAN Number *</Label>
                  <Input value={form.panNumber} onChange={(e) => update("panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" required className="mt-1.5 rounded-xl" />
                </div>
              )}
              {isPassportMandatory && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passport Number *</Label><Input value={form.passportNumber} onChange={(e) => update("passportNumber", e.target.value)} required className="mt-1.5 rounded-xl" /></div>
                  <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passport Expiry *</Label><Input type="date" value={form.passportExpiry} onChange={(e) => update("passportExpiry", e.target.value)} required className="mt-1.5 rounded-xl" /></div>
                  <div><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nationality</Label><Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} className="mt-1.5 rounded-xl" /></div>
                </div>
              )}

              <div className="mt-4">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Special Requests</Label>
                <Input value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} placeholder="Late check-in, extra pillows, etc." className="mt-1.5 rounded-xl" />
              </div>
            </div>

            {/* Selected Room */}
            {roomDetails.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
                <h2 className="text-lg font-bold text-foreground mb-4">Selected Room</h2>
                <div className="space-y-2">
                  {roomDetails.map((room: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{room.name || "Room"}</p>
                        {room.mealBasis && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Utensils className="w-3 h-3" /> {room.mealBasis}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    {isRefundable ? (
                      <Badge variant="outline" className="text-[hsl(var(--success))] border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 text-xs gap-1">
                        <ShieldCheck className="w-3 h-3" /> Free Cancellation
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5 text-xs gap-1">
                        <AlertTriangle className="w-3 h-3" /> Non-refundable
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" /> Payment Method
              </h2>
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <label key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPayment === method.id ? "border-primary bg-primary/5 shadow-sm" : "border-border/30 hover:border-primary/30"}`}>
                      <input type="radio" name="payment" value={method.id} checked={selectedPayment === method.id} onChange={() => setSelectedPayment(method.id)} className="sr-only" />
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedPayment === method.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <Button type="submit" size="lg" className="w-full h-14 rounded-xl font-bold text-base shadow-xl shadow-primary/20" disabled={loading || reviewLoading || revalidating || !!reviewError}>
              {loading ? "Processing..." : revalidating ? "Revalidating..." : reviewLoading ? "Verifying..." : reviewError ? "Unavailable" : `Confirm & Pay Securely — ${fmt(total)}`}
            </Button>
            <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span>No hidden fees</span>
              <span>•</span>
              <span>Secure SSL encryption</span>
              {isRefundable && (
                <>
                  <span>•</span>
                  <span>Free cancellation</span>
                </>
              )}
            </div>
          </form>

          {/* Sticky Summary */}
          <div>
            <div className="sticky top-24 bg-card rounded-2xl border border-border/30 p-6" style={{ boxShadow: "var(--card-shadow)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Booking Summary</h3>
              </div>

              <div className="mb-4">
                <p className="font-bold text-foreground">{hotel.name}</p>
                <p className="text-sm text-muted-foreground">{roomName} • {hotel.city}</p>
              </div>

              {paramCheckin && paramCheckout && (
                <div className="bg-muted/30 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span className="font-medium text-foreground">{paramCheckin}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span className="font-medium text-foreground">{paramCheckout}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium text-foreground">{nights} night{nights > 1 ? "s" : ""}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Guests</span><span className="font-medium text-foreground">{paramAdults} Adult{paramAdults > 1 ? 's' : ''}{paramChildren > 0 ? `, ${paramChildren} Child` : ''}</span></div>
                </div>
              )}

              <div className="border-t border-border/30 pt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Room Total</span><span className="font-medium">{fmt(subtotal)}</span></div>
                {reviewPrice !== roomPrice && roomPrice > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Original price</span><span className="line-through">{fmt(roomPrice)}</span>
                  </div>
                )}
                {convenienceFee > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Convenience Fee</span><span className="font-medium">{fmt(convenienceFee)}</span></div>}
                <div className="border-t border-border/30 pt-3 flex justify-between items-baseline">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="text-2xl font-extrabold text-primary">{fmt(total)}</span>
                </div>
              </div>

              {/* Trust row */}
              <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Lock className="w-3 h-3 text-primary" /> <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="w-3 h-3 text-primary" /> <span>Best price guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HotelBooking;
