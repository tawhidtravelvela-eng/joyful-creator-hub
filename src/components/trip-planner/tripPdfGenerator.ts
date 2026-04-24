/**
 * Premium PDF generation for trip itineraries.
 * Apple/Airbnb-inspired luxury design with emotional engagement.
 */
import jsPDF from "jspdf";
import type { Itinerary } from "./tripTypes";
import { resolveCity, formatTravelerBreakdown } from "./tripPricingUtils";

interface PdfBranding {
  site_name?: string;
  logo_url?: string;
}

export async function loadPdfImage(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// ═══ LUXURY COLOR PALETTE ═══
const C = {
  // Core
  charcoal:   [28, 28, 30],     // near-black for headings
  ink:        [44, 44, 46],     // dark text
  stone:      [99, 99, 102],    // body text
  silver:     [142, 142, 147],  // muted labels
  cloud:      [174, 174, 178],  // faint text
  mist:       [229, 229, 234],  // borders
  snow:       [242, 242, 247],  // card backgrounds
  white:      [255, 255, 255],

  // Brand
  brandPrimary: [0, 102, 255],    // vibrant blue
  brandDeep:    [0, 64, 221],     // dark blue
  brandSoft:    [230, 240, 255],  // blue tint bg

  // Accent palette
  emerald:    [52, 199, 89],
  emeraldBg:  [230, 250, 235],
  coral:      [255, 69, 58],
  amber:      [255, 159, 10],
  amberBg:    [255, 248, 230],
  violet:     [175, 82, 222],
  teal:       [0, 199, 190],

  // Category colors
  flight:     [0, 102, 255],
  hotel:      [255, 159, 10],
  activity:   [52, 199, 89],
  transfer:   [255, 149, 0],
  meal:       [175, 82, 222],
  free:       [0, 199, 190],
  buffer:     [174, 174, 178],

  // Time-of-day
  morning:    [52, 199, 89],    // green
  afternoon:  [255, 204, 0],    // yellow
  evening:    [0, 122, 255],    // blue
} as const;

type RGB = readonly number[];

// Time-of-day classifier
function getTimeSlot(time: string): "morning" | "afternoon" | "evening" {
  if (!time) return "morning";
  const h = parseInt(time.split(":")[0], 10);
  if (isNaN(h)) return "morning";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const TIME_LABELS: Record<string, { label: string; icon: string; color: RGB }> = {
  morning:   { label: "Morning",   icon: "AM", color: C.morning },
  afternoon: { label: "Afternoon", icon: "PM", color: C.afternoon },
  evening:   { label: "Evening",   icon: "PM", color: C.evening },
};

export async function generateItineraryPdf(
  itinerary: Itinerary,
  branding: PdfBranding,
  itineraryCode?: string | null,
): Promise<void> {
  const siteName = branding.site_name || "Travel Vela";
  const logoUrl = branding.logo_url || "";
  let logoDataUrl: string | null = null;
  if (logoUrl) logoDataUrl = await loadPdfImage(logoUrl);
  const cur = itinerary.budget_estimate?.currency || "USD";
  const fmtP = (n: number) => Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtC = (n: number) => `${cur} ${fmtP(n)}`;

  const pdf = new jsPDF("p", "mm", "a4");
  const W = 210, H = 297, MX = 16, MY = 16;
  const CW = W - MX * 2;
  let y = 0;
  let pageNum = 1;

  // ── Helpers ──
  const setC = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const setF = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setD = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
  const rr = (x: number, ry: number, w: number, h: number, r: number, style = "F") =>
    pdf.roundedRect(x, ry, w, h, r, r, style);

  const wrap = (text: string, maxW: number, fontSize: number): string[] => {
    pdf.setFontSize(fontSize);
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (pdf.getTextWidth(test) > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const safe = (s: string): string => {
    if (!s) return "";
    return s
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, "")
      .replace(/[^\x00-\x7F]/g, (ch) => {
        const code = ch.charCodeAt(0);
        if (code >= 0xC0 && code <= 0xFF) return ch;
        return "";
      })
      .replace(/\s+/g, " ")
      .trim();
  };

  const starStr = (n: number): string => (!n || n <= 0) ? "" : `${"*".repeat(Math.min(n, 5))} ${n}-Star`;

  // ── Subtle diagonal watermark ──
  const addWatermark = () => {
    pdf.saveGraphicsState();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(48);
    pdf.setTextColor(200, 210, 220);        // very light blue-grey
    (pdf as any).setGState(new (pdf as any).GState({ opacity: 0.07 }));
    const cx = W / 2;
    const cy = H / 2;
    // Rotate -35° and draw centred
    const angle = -35 * (Math.PI / 180);
    pdf.text(siteName, cx, cy, { align: "center", angle });
    pdf.restoreGraphicsState();
    // reset text color for subsequent draws
    setC(C.ink);
  };

  // ── Minimal footer ──
  const addFooter = () => {
    addWatermark();
    setC(C.cloud);
    pdf.setFontSize(6);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${pageNum}`, W / 2, H - 8, { align: "center" });

    // Subtle brand
    pdf.setFontSize(5.5);
    pdf.text(siteName, MX, H - 8);
    pdf.text("Prices subject to change at time of booking", W - MX, H - 8, { align: "right" });
  };

  const needPage = (needed: number): boolean => {
    if (y + needed > H - 18) {
      addFooter();
      pdf.addPage();
      pageNum++;
      y = MY;
      return true;
    }
    return false;
  };

  const getTypeColor = (type: string): RGB => {
    return (C as any)[type] || C.activity;
  };

  // ═══════════════════════════════════════════════
  // PAGE 1: LUXURY COVER
  // ═══════════════════════════════════════════════

  // Full-page gradient background
  setF(C.charcoal);
  pdf.rect(0, 0, W, H, "F");

  // Subtle gradient overlay (lighter at center)
  for (let i = 0; i < 30; i++) {
    const alpha = 0.01;
    pdf.setFillColor(255, 255, 255);
    const gs = (pdf as any).GState({ opacity: alpha });
    (pdf as any).setGState(gs);
    pdf.circle(W / 2, H * 0.35, 40 + i * 3, "F");
  }
  const gsReset = (pdf as any).GState({ opacity: 1 });
  (pdf as any).setGState(gsReset);

  // Top bar — logo or brand
  if (logoDataUrl) {
    try { pdf.addImage(logoDataUrl, "PNG", MX, 20, 36, 14); } catch {}
  } else {
    setC([255, 255, 255]);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(siteName, MX, 30);
  }

  // Itinerary code (top right)
  if (itineraryCode) {
    setC(C.cloud);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(itineraryCode, W - MX, 28, { align: "right" });
  }

  // Trip title — large, centered
  const coverTitle = safe(itinerary.trip_title || `Journey to ${itinerary.destination}`);
  setC([255, 255, 255]);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  const coverLines = wrap(coverTitle, CW - 20, 28);
  let cy = H * 0.33;
  for (const line of coverLines) {
    pdf.text(line, W / 2, cy, { align: "center" });
    cy += 13;
  }

  // Accent line under title
  const lineW = 40;
  setF(C.brandPrimary);
  pdf.rect(W / 2 - lineW / 2, cy + 2, lineW, 1, "F");

  // Subtitle
  cy += 12;
  setC(C.cloud);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const subtitleParts = [
    `${itinerary.duration_days} Days`,
    formatTravelerBreakdown(itinerary.adults || itinerary.travelers, itinerary.children || 0, itinerary.infants || 0),
    itinerary.best_time_to_visit || "",
  ].filter(Boolean);
  pdf.text(subtitleParts.join("   |   "), W / 2, cy, { align: "center" });

  // Emotional tagline
  cy += 12;
  if (itinerary.conversion_summary?.trip_style) {
    setC(C.silver);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    const style = safe(itinerary.conversion_summary.trip_style);
    const styleLines = wrap(style, CW - 40, 8);
    for (const sl of styleLines.slice(0, 2)) {
      pdf.text(sl, W / 2, cy, { align: "center" });
      cy += 5;
    }
  }

  // Total budget — prominent
  cy = H * 0.68;
  setC(C.silver);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text("TOTAL TRIP COST", W / 2, cy, { align: "center" });
  cy += 9;
  setC([255, 255, 255]);
  pdf.setFontSize(26);
  pdf.setFont("helvetica", "bold");
  pdf.text(fmtC(itinerary.budget_estimate.total), W / 2, cy, { align: "center" });
  cy += 6;
  const perPerson = itinerary.travelers > 0 ? Math.round(itinerary.budget_estimate.total / itinerary.travelers) : null;
  if (perPerson && itinerary.travelers > 1) {
    setC(C.silver);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${fmtC(perPerson)} per person`, W / 2, cy, { align: "center" });
  }

  // Date generated (bottom)
  setC([80, 80, 84]);
  pdf.setFontSize(6);
  pdf.setFont("helvetica", "normal");
  const genDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  pdf.text(`Generated ${genDate}`, W / 2, H - 20, { align: "center" });

  // ═══════════════════════════════════════════════
  // PAGE 2: TRIP SNAPSHOT
  // ═══════════════════════════════════════════════
  pdf.addPage();
  pageNum++;
  y = MY;

  // Section title
  setC(C.charcoal);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("Trip Snapshot", MX, y + 6);
  y += 14;

  // Thin accent line
  setF(C.brandPrimary);
  pdf.rect(MX, y, 30, 0.8, "F");
  y += 8;

  // ── Destinations Timeline ──
  const cities = itinerary.days.reduce((acc: { name: string; days: number; startDay: number }[], day) => {
    const cityName = safe(day.city || itinerary.destination);
    const last = acc[acc.length - 1];
    if (last && last.name === cityName) {
      last.days++;
    } else {
      acc.push({ name: cityName, days: 1, startDay: day.day });
    }
    return acc;
  }, []);

  if (cities.length > 0) {
    const timelineH = 18;
    const timelineY = y;
    const timelineW = CW;
    const totalDays = itinerary.duration_days || cities.reduce((s, c) => s + c.days, 0);

    // Background track
    setF(C.snow);
    rr(MX, timelineY, timelineW, timelineH, 4);

    let tx = MX + 4;
    const cityColors: RGB[] = [C.brandPrimary, C.emerald, C.amber, C.violet, C.coral, C.teal];
    cities.forEach((city, ci) => {
      const segW = Math.max(20, (city.days / totalDays) * (timelineW - 8));
      const cc = cityColors[ci % cityColors.length];

      // Segment bar
      setF(cc);
      rr(tx, timelineY + 3, segW, 4, 2);

      // City name
      setC(C.charcoal);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.text(city.name, tx + 1, timelineY + 13);

      // Days count
      setC(C.silver);
      pdf.setFontSize(5.5);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${city.days}d`, tx + 1, timelineY + 16.5);

      // Arrow between segments
      if (ci < cities.length - 1) {
        setC(C.cloud);
        pdf.setFontSize(8);
        pdf.text("→", tx + segW + 1, timelineY + 10);
        tx += segW + 8;
      } else {
        tx += segW + 4;
      }
    });
    y += timelineH + 8;
  }

  // ── Budget Breakdown Cards ──
  const bdKeys = Object.entries(itinerary.budget_estimate.breakdown).filter(([, v]) => (v as number) > 0);
  if (bdKeys.length > 0) {
    const cardCols = Math.min(bdKeys.length, 4);
    const cardGap = 4;
    const cardW = (CW - (cardCols - 1) * cardGap) / cardCols;
    const cardH = 28;

    const bdColors: RGB[] = [C.brandPrimary, C.amber, C.emerald, C.violet, C.coral, C.teal];

    for (let i = 0; i < bdKeys.length; i++) {
      const col = i % cardCols;
      const row = Math.floor(i / cardCols);
      const cx = MX + col * (cardW + cardGap);
      const cyy = y + row * (cardH + cardGap);

      if (i > 0 && col === 0) needPage(cardH + 6);

      setF(C.snow);
      setD(C.mist);
      rr(cx, cyy, cardW, cardH, 5, "FD");

      // Color dot
      const dotColor = bdColors[i % bdColors.length];
      setF(dotColor);
      pdf.circle(cx + 7, cyy + 8, 2, "F");

      // Category name
      setC(C.silver);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      const catName = bdKeys[i][0].charAt(0).toUpperCase() + bdKeys[i][0].slice(1);
      pdf.text(catName.toUpperCase(), cx + 12, cyy + 9);

      // Amount
      setC(C.charcoal);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(fmtC(bdKeys[i][1] as number), cx + 7, cyy + 19);

      // Percentage
      const pct = Math.round(((bdKeys[i][1] as number) / itinerary.budget_estimate.total) * 100);
      setC(C.cloud);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${pct}%`, cx + cardW - 7, cyy + 9, { align: "right" });
    }
    y += Math.ceil(bdKeys.length / cardCols) * (cardH + cardGap) + 6;
  }

  // ── Flights Summary ──
  const flightLegs: { label: string; airline: string; flightNo: string; departure: string; arrival: string; duration: string; isLive: boolean }[] = [];
  const sf = itinerary.selected_flight;
  if (sf) {
    const addLeg = (leg: any, label: string) => {
      if (!leg) return;
      flightLegs.push({
        label, airline: safe(leg.airline), flightNo: leg.flight_number || "",
        departure: leg.departure || "", arrival: leg.arrival || "",
        duration: leg.duration || "", isLive: !!(leg as any).is_live_price || !!sf.is_live_price,
      });
    };
    if (sf.outbound) addLeg(sf.outbound, `${resolveCity(sf.outbound.from)} → ${resolveCity(sf.outbound.to)}`);
    for (const leg of sf.inter_city_legs || []) addLeg(leg, `${resolveCity(leg.from)} → ${resolveCity(leg.to)}`);
    if (sf.inbound) addLeg(sf.inbound, `${resolveCity(sf.inbound.from)} → ${resolveCity(sf.inbound.to)}`);
  }

  const allHotels: { name: string; city: string; stars: number; nights: number; totalPrice: number; roomType: string; mealBasis: string; isLive: boolean }[] = [];
  if (itinerary.selected_hotels?.length) {
    for (const sh of itinerary.selected_hotels) {
      allHotels.push({
        name: safe(sh.name), city: safe(sh.city || ""), stars: sh.stars || 0,
        nights: sh.nights || 1, totalPrice: sh.total_price || 0,
        roomType: safe(sh.room_type || ""), mealBasis: sh.meal_basis || "Room only",
        isLive: !!sh.is_live_price,
      });
    }
  } else if (itinerary.selected_hotel) {
    const sh = itinerary.selected_hotel;
    allHotels.push({
      name: safe(sh.name), city: safe(itinerary.destination || ""), stars: sh.stars || 0,
      nights: sh.nights || 1, totalPrice: sh.total_price || 0,
      roomType: safe(sh.room_type || ""), mealBasis: sh.meal_basis || "Room only",
      isLive: !!sh.is_live_price,
    });
  }

  // Flights section
  if (flightLegs.length > 0) {
    needPage(14 + flightLegs.length * 16);
    setC(C.charcoal);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Flights", MX, y + 4);

    if (sf) {
      setC(C.brandPrimary);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(fmtC(sf.price || 0), W - MX, y + 4, { align: "right" });
      if (sf.is_live_price) {
        drawPillBadge(pdf, W - MX - pdf.getTextWidth(fmtC(sf.price || 0)) - 18, y - 1, "LIVE", C.emerald, C.emeraldBg);
      }
    }
    y += 8;

    for (const fl of flightLegs) {
      needPage(16);
      setF(C.snow);
      setD(C.mist);
      rr(MX, y, CW, 14, 4, "FD");

      // Blue left accent
      setF(C.flight);
      rr(MX, y, 2, 14, 1);

      setC(C.charcoal);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(fl.label, MX + 7, y + 5.5);

      setC(C.stone);
      pdf.setFontSize(6.5);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${fl.airline}  ${fl.flightNo}`.trim(), MX + 7, y + 10);
      pdf.text(`${fl.departure} - ${fl.arrival}  |  ${fl.duration}`, MX + CW * 0.45, y + 10);

      y += 17;
    }
    y += 4;
  }

  // Hotels section
  if (allHotels.length > 0) {
    needPage(14 + allHotels.length * 18);
    setC(C.charcoal);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Accommodation", MX, y + 4);
    y += 8;

    for (const ht of allHotels) {
      needPage(18);
      setF(C.snow);
      setD(C.mist);
      rr(MX, y, CW, 16, 4, "FD");

      // Amber left accent
      setF(C.hotel);
      rr(MX, y, 2, 16, 1);

      // City label
      if (ht.city) {
        setC(C.amber);
        pdf.setFontSize(5.5);
        pdf.setFont("helvetica", "bold");
        pdf.text(ht.city.toUpperCase(), MX + 7, y + 5);
      }

      setC(C.charcoal);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(ht.name.substring(0, 40), MX + 7, y + 10);

      setC(C.stone);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "normal");
      const hotelMeta = [starStr(ht.stars), `${ht.nights} night${ht.nights > 1 ? "s" : ""}`, ht.mealBasis].filter(Boolean).join("  |  ");
      pdf.text(hotelMeta.substring(0, 55), MX + 7, y + 14);

      // Price right-aligned
      setC(C.amber);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(fmtC(ht.totalPrice), W - MX - 5, y + 10, { align: "right" });
      if (ht.isLive) {
        drawPillBadge(pdf, W - MX - 5 - pdf.getTextWidth(fmtC(ht.totalPrice)) - 18, y + 4, "LIVE", C.emerald, C.emeraldBg);
      }

      y += 19;
    }
  }

  addFooter();

  // ═══════════════════════════════════════════════
  // DAY PAGES — Time-of-Day Card Layout
  // ═══════════════════════════════════════════════

  let prevCity = "";

  for (const day of itinerary.days) {
    const dayCity = safe(day.city || itinerary.destination);

    // ── City Divider Page (when city changes) ──
    if (dayCity && dayCity !== prevCity) {
      pdf.addPage();
      pageNum++;

      // Dark background
      setF(C.charcoal);
      pdf.rect(0, 0, W, H, "F");

      // City name — large centered
      setC([255, 255, 255]);
      pdf.setFontSize(36);
      pdf.setFont("helvetica", "bold");
      pdf.text(dayCity, W / 2, H * 0.4, { align: "center" });

      // Accent line
      setF(C.brandPrimary);
      pdf.rect(W / 2 - 20, H * 0.4 + 6, 40, 1, "F");

      // City intro if available
      const cityIntroText = itinerary.conversion_summary?.highlight_experiences
        ?.filter(h => h.toLowerCase().includes(dayCity.toLowerCase()))
        .join(" | ") || "";
      if (cityIntroText) {
        setC(C.silver);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        const introLines = wrap(cityIntroText, CW - 40, 8);
        let iy = H * 0.4 + 16;
        for (const il of introLines.slice(0, 3)) {
          pdf.text(il, W / 2, iy, { align: "center" });
          iy += 5;
        }
      }

      // "Your stay" info
      const cityHotel = allHotels.find(h => h.city.toLowerCase() === dayCity.toLowerCase());
      if (cityHotel) {
        setC(C.cloud);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Staying at ${cityHotel.name}`, W / 2, H * 0.55, { align: "center" });
        pdf.text(
          [starStr(cityHotel.stars), `${cityHotel.nights} nights`, cityHotel.mealBasis].filter(Boolean).join("  |  "),
          W / 2, H * 0.55 + 6, { align: "center" },
        );
      }

      addFooter();
      prevCity = dayCity;
    }

    // ── Day Page ──
    pdf.addPage();
    pageNum++;
    y = MY;

    // ── Day Header (clean, minimal) ──
    // Day number circle
    setF(C.brandPrimary);
    pdf.circle(MX + 7, y + 5, 6, "F");
    setC(C.white);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(day.day), MX + 7, y + 6.5, { align: "center" });

    // Day title
    setC(C.charcoal);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    const dayTitle = safe(day.title || `Day ${day.day}`).substring(0, 45);
    pdf.text(dayTitle, MX + 17, y + 3);

    // Mood/energy tag based on activity count
    const actCount = day.activities.filter(a => inferCategory(a) === "activity" || inferCategory(a) === "free").length;
    const mood = actCount >= 4 ? "High Energy" : actCount >= 2 ? "Balanced" : "Relaxed";
    const moodColor = actCount >= 4 ? C.coral : actCount >= 2 ? C.brandPrimary : C.emerald;
    drawPillBadge(pdf, MX + 17 + pdf.getTextWidth(dayTitle) + 3, y - 2, mood, moodColor, C.snow);

    // Meta line
    setC(C.silver);
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    const dayMeta = [dayCity, day.date, `${day.activities.length} activities`].filter(Boolean).join("   |   ");
    pdf.text(dayMeta, MX + 17, y + 9);

    // Hotel info (right side)
    if (day.hotel?.name) {
      setC(C.cloud);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        safe(day.hotel.name).substring(0, 35),
        W - MX, y + 3, { align: "right" },
      );
      setC(C.cloud);
      pdf.setFontSize(5.5);
      pdf.text(
        [starStr(day.hotel.stars || 0), day.hotel.area || ""].filter(Boolean).join("  |  ").substring(0, 30),
        W - MX, y + 8, { align: "right" },
      );
    }

    y += 18;

    // Thin divider
    setF(C.mist);
    pdf.rect(MX, y, CW, 0.3, "F");
    y += 6;

    // ── Group activities by time-of-day ──
    type SlotKey = "morning" | "afternoon" | "evening";
    const grouped: Record<SlotKey, typeof day.activities> = { morning: [], afternoon: [], evening: [] };
    for (const act of day.activities) {
      const slot = getTimeSlot(act.time);
      grouped[slot].push(act);
    }

    for (const slot of ["morning", "afternoon", "evening"] as SlotKey[]) {
      const acts = grouped[slot];
      if (acts.length === 0) continue;

      const slotInfo = TIME_LABELS[slot];

      // Time-of-day header
      needPage(10);
      setF(slotInfo.color);
      pdf.circle(MX + 3, y + 2.5, 1.8, "F");
      setC(C.charcoal);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(slotInfo.label, MX + 8, y + 4);
      y += 8;

      // Activity cards
      for (const act of acts) {
        const catKey = inferCategory(act);
        const typeColor = getTypeColor(catKey);
        const actTitle = safe((act as any).product_name || act.activity).substring(0, 55);
        const optionTitle = safe((act as any).option_title || (act as any).product_option_title || "");
        const highlights: string[] = ((act as any).highlights || []).slice(0, 3).map((h: string) => safe(h).substring(0, 35));
        const description = act.description ? safe(act.description) : "";
        const descLines = description ? wrap(description, CW - 28, 6.5).slice(0, 2) : [];
        const isBookable = !!(act as any).product_code && act.cost_estimate > 0;
        const isFree = (act as any).source === "free" || catKey === "free" || (!act.cost_estimate || act.cost_estimate === 0);
        const isLive = !!act.is_live_price;

        // Calculate card height
        let cardH = 14;
        if (optionTitle) cardH += 5;
        if (highlights.length > 0) cardH += 4;
        if (descLines.length > 0) cardH += descLines.length * 3.5;
        if (act.tips) cardH += 8;
        cardH = Math.max(cardH, 16);

        needPage(cardH + 4);

        // Card background
        setF(C.white);
        setD(C.mist);
        pdf.setLineWidth(0.3);
        rr(MX + 4, y, CW - 4, cardH, 4, "FD");

        // Left accent bar
        setF(typeColor);
        rr(MX + 4, y + 2, 1.5, cardH - 4, 0.75);

        // Time badge
        if (act.time) {
          setC(typeColor);
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.text(act.time, MX + 10, y + 5.5);
        }

        // Category pill
        const catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
        const timeW = act.time ? pdf.getTextWidth(act.time) + 2 : 0;
        setC(C.cloud);
        pdf.setFontSize(5);
        pdf.setFont("helvetica", "normal");
        pdf.text(catLabel, MX + 10 + timeW, y + 5.5);

        // Activity name
        setC(isBookable ? C.charcoal : C.ink);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        const maxTitleW = CW - 55;
        const titleText = pdf.getTextWidth(actTitle) > maxTitleW ? actTitle.substring(0, 45) + "..." : actTitle;
        pdf.text(titleText, MX + 10, y + 11);

        // Badges
        const badgeX = MX + 10 + pdf.getTextWidth(titleText) + 3;
        if (isBookable && (act.rating || 0) >= 4) {
          drawPillBadge(pdf, badgeX, y + 6.5, "Top Rated", C.amber, C.amberBg);
        }

        let detailY = y + 14.5;

        // Option title
        if (optionTitle) {
          setF(C.brandSoft);
          const optText = optionTitle.substring(0, 50);
          pdf.setFontSize(5.5);
          const optW = pdf.getTextWidth(`Option: ${optText}`) + 5;
          rr(MX + 10, detailY - 2.5, optW, 4.5, 1.5);
          setC(C.brandPrimary);
          pdf.setFont("helvetica", "bold");
          pdf.text(`Option: ${optText}`, MX + 12.5, detailY);
          detailY += 5;
        }

        // Highlights
        if (highlights.length > 0) {
          setC(C.emerald);
          pdf.setFontSize(5.5);
          pdf.setFont("helvetica", "normal");
          pdf.text(highlights.join("  |  ").substring(0, 70), MX + 10, detailY);
          detailY += 4;
        }

        // Description
        if (descLines.length > 0) {
          setC(C.stone);
          pdf.setFontSize(6.5);
          pdf.setFont("helvetica", "normal");
          for (const dl of descLines) {
            pdf.text(dl, MX + 10, detailY);
            detailY += 3.5;
          }
        }

        // AI Tip
        if (act.tips) {
          const tipText = safe(act.tips).substring(0, 80);
          setF(C.brandSoft);
          const tipW = pdf.getTextWidth(`Vela AI Tip: ${tipText}`) + 6;
          rr(MX + 10, detailY, Math.min(tipW, CW - 22), 5, 1.5);
          setC(C.brandPrimary);
          pdf.setFontSize(5.5);
          pdf.setFont("helvetica", "bold");
          pdf.text("Vela AI Tip:", MX + 12, detailY + 3.3);
          setC(C.brandDeep);
          pdf.setFont("helvetica", "normal");
          pdf.text(tipText, MX + 12 + pdf.getTextWidth("Vela AI Tip: ") + 1, detailY + 3.3);
        }

        // Price badge (right-aligned in card)
        if (act.cost_estimate > 0) {
          const isEst = !isLive;
          const costStr = isEst ? `~${fmtC(act.cost_estimate)}` : fmtC(act.cost_estimate);
          pdf.setFontSize(7.5);
          pdf.setFont("helvetica", "bold");

          if (isEst) {
            setC(C.amber);
            pdf.text(costStr, W - MX - 6, y + 6, { align: "right" });
            setC(C.cloud);
            pdf.setFontSize(4.5);
            pdf.setFont("helvetica", "normal");
            pdf.text("estimate", W - MX - 6, y + 10, { align: "right" });
          } else {
            setC(C.emerald);
            pdf.text(costStr, W - MX - 6, y + 6, { align: "right" });
            drawPillBadge(pdf, W - MX - 18, y + 8, "LIVE", C.emerald, C.emeraldBg);
          }
        } else if (catKey === "activity" || catKey === "free") {
          setC(C.emerald);
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.text("Free", W - MX - 6, y + 7, { align: "right" });
        }

        y += cardH + 3;
      }

      y += 2; // gap between time slots
    }

    // ── Day Total Bar ──
    const dayTotal = day.activities.reduce((s: number, a: any) => s + (a.cost_estimate || 0), 0);
    if (dayTotal > 0) {
      needPage(12);
      setF(C.snow);
      rr(MX, y, CW, 9, 3);
      setC(C.stone);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Day ${day.day} Total`, MX + 8, y + 6);
      setC(C.charcoal);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(fmtC(dayTotal), W - MX - 6, y + 6, { align: "right" });
      y += 14;
    }

    addFooter();
  }

  // ═══════════════════════════════════════════════
  // FINAL PAGES: Tips & Inclusions + CTA
  // ═══════════════════════════════════════════════

  const hasTips = itinerary.tips?.length > 0;
  const hasInclExcl = itinerary.included?.length || itinerary.excluded?.length;

  if (hasTips || hasInclExcl) {
    pdf.addPage();
    pageNum++;
    y = MY;

    setC(C.charcoal);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Good to Know", MX, y + 6);
    y += 14;

    setF(C.brandPrimary);
    pdf.rect(MX, y, 30, 0.8, "F");
    y += 8;

    // Included
    if (itinerary.included?.length) {
      setC(C.charcoal);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("What's Included", MX, y + 4);
      y += 8;
      for (const item of itinerary.included) {
        needPage(6);
        setC(C.emerald);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.text("+", MX + 4, y + 3);
        setC(C.ink);
        pdf.setFont("helvetica", "normal");
        pdf.text(safe(item).substring(0, 80), MX + 9, y + 3);
        y += 5.5;
      }
      y += 6;
    }

    // Excluded
    if (itinerary.excluded?.length) {
      needPage(10);
      setC(C.charcoal);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("Not Included", MX, y + 4);
      y += 8;
      for (const item of itinerary.excluded) {
        needPage(6);
        setC(C.coral);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.text("-", MX + 4, y + 3);
        setC(C.ink);
        pdf.setFont("helvetica", "normal");
        pdf.text(safe(item).substring(0, 80), MX + 9, y + 3);
        y += 5.5;
      }
      y += 6;
    }

    // Tips
    if (hasTips) {
      needPage(15);
      setC(C.charcoal);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("Vela AI Travel Tips", MX, y + 4);
      y += 9;

      for (const tip of itinerary.tips) {
        const tipLines = wrap(safe(tip), CW - 14, 7);
        needPage(tipLines.length * 3.5 + 6);

        setF(C.brandSoft);
        rr(MX, y, CW, tipLines.length * 3.8 + 4, 3);

        setC(C.brandPrimary);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.text("TIP", MX + 5, y + 5);

        setC(C.ink);
        pdf.setFont("helvetica", "normal");
        let tipY = y + 5;
        for (const tl of tipLines) {
          pdf.text(tl, MX + 14, tipY);
          tipY += 3.8;
        }
        y += tipLines.length * 3.8 + 7;
      }
    }

    addFooter();
  }

  // ═══════════════════════════════════════════════
  // BOOKING CTA PAGE
  // ═══════════════════════════════════════════════
  pdf.addPage();
  pageNum++;

  setF(C.charcoal);
  pdf.rect(0, 0, W, H, "F");

  // Title
  setC([255, 255, 255]);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("Ready to Book?", W / 2, H * 0.3, { align: "center" });

  // Accent
  setF(C.brandPrimary);
  pdf.rect(W / 2 - 20, H * 0.3 + 5, 40, 1, "F");

  // Subtitle
  setC(C.silver);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Your personalized itinerary is ready. Take the next step.", W / 2, H * 0.3 + 16, { align: "center" });

  // CTA buttons
  const ctaY = H * 0.44;
  const ctaW = 52;
  const ctaH = 11;
  const ctaGap = 8;

  // Book This Trip
  setF(C.brandPrimary);
  rr(W / 2 - ctaW / 2, ctaY, ctaW, ctaH, 5);
  setC(C.white);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("Book This Trip", W / 2, ctaY + 7, { align: "center" });

  // Customize with AI
  setD([255, 255, 255]);
  pdf.setLineWidth(0.5);
  rr(W / 2 - ctaW / 2, ctaY + ctaH + ctaGap, ctaW, ctaH, 5, "S");
  setC([255, 255, 255]);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("Customize with AI", W / 2, ctaY + ctaH + ctaGap + 7, { align: "center" });

  // Chat with Vela
  setD(C.silver);
  rr(W / 2 - ctaW / 2, ctaY + (ctaH + ctaGap) * 2, ctaW, ctaH, 5, "S");
  setC(C.silver);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("Chat with Vela AI", W / 2, ctaY + (ctaH + ctaGap) * 2 + 7, { align: "center" });

  // Total price reminder
  setC(C.silver);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("Starting from", W / 2, H * 0.7, { align: "center" });
  setC([255, 255, 255]);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text(fmtC(itinerary.budget_estimate.total), W / 2, H * 0.7 + 10, { align: "center" });

  // Subtle brand footer on CTA page
  if (logoDataUrl) {
    try {
      const gs2 = (pdf as any).GState({ opacity: 0.5 });
      (pdf as any).setGState(gs2);
      pdf.addImage(logoDataUrl, "PNG", W / 2 - 15, H - 25, 30, 12);
      const gs3 = (pdf as any).GState({ opacity: 1 });
      (pdf as any).setGState(gs3);
    } catch {}
  } else {
    setC([80, 80, 84]);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(siteName, W / 2, H - 18, { align: "center" });
  }

  addFooter();

  // ── Save ──
  const safeName = itinerary.destination.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-");
  pdf.save(`${siteName.replace(/\s+/g, "")}-${safeName}-Itinerary.pdf`);
}

// ── Helper: draw a small pill badge ──
function drawPillBadge(pdf: jsPDF, x: number, y: number, text: string, textColor: RGB, bgColor: RGB) {
  pdf.setFontSize(5);
  pdf.setFont("helvetica", "bold");
  const w = pdf.getTextWidth(text) + 5;
  pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  pdf.roundedRect(x, y, w, 5, 2, 2, "F");
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.text(text, x + 2.5, y + 3.5);
}

// ── Infer activity category for PDF rendering ──
function inferCategory(act: any): string {
  const name = (act.activity || "").toLowerCase();
  const cat = (act.category || "").toLowerCase();
  if (cat === "transport" || /airport.*transfer|hotel.*transfer|transfer|sedan|suv/i.test(name)) return "transfer";
  if (cat === "hotel" || /check.?in|check.?out|hotel.*refresh/i.test(name)) return "hotel";
  if (/flight|depart|arrive|arrival/i.test(name) || cat === "flight") return "flight";
  if (/free.*exploration|free.*time|leisure|wander|stroll|explore.*own/i.test(name) || cat === "free_activity" || cat === "free") return "free";
  if (/meal|lunch|dinner|breakfast|dining/i.test(name) || cat === "food") return "meal";
  if (/buffer|break|rest.*buffer|recovery/i.test(name)) return "buffer";
  return "activity";
}
