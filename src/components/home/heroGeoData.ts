// Geo-aware data constants extracted from HeroSection to reduce file size

export const smartHints = [
  "💡 Tip: Flexible dates save up to 40%",
  "🔥 Bangkok is trending this week",
  "🟢 Cheapest flights to Dubai from $189",
  "✈️ Try multi-city for better deals",
];

/** Smart price rounding: produces natural-looking prices per currency */
export const smartRound = (base: number, curr: string): number => {
  const approxRates: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, BDT: 121, CNY: 7.2 };
  const rate = approxRates[curr] || 1;
  const raw = base * rate;
  if (raw >= 10000) return Math.round(raw / 500) * 500;
  if (raw >= 1000) return Math.round(raw / 100) * 100;
  if (raw >= 100) return Math.round(raw / 10) * 10;
  if (raw >= 10) return Math.round(raw / 5) * 5;
  return Math.round(raw);
};

export interface GeoDestCard {
  emoji: string;
  city: string;
  basePrice: number;
  tag: string;
  route: string;
}

export const geoDestinations: Record<string, GeoDestCard[]> = {
  BD: [
    { emoji: "🌆", city: "Dubai", basePrice: 380, tag: "Popular", route: "/flights?from=DAC&to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 270, tag: "Trending", route: "/flights?from=DAC&to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Kuala Lumpur", basePrice: 240, tag: "Cheapest", route: "/flights?from=DAC&to=KUL&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Singapore", basePrice: 320, tag: "Hot Deal", route: "/flights?from=DAC&to=SIN&adults=1&class=Economy" },
  ],
  IN: [
    { emoji: "🌆", city: "Dubai", basePrice: 210, tag: "Popular", route: "/flights?from=DEL&to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 175, tag: "Trending", route: "/flights?from=DEL&to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Paris", basePrice: 490, tag: "Dream Trip", route: "/flights?from=DEL&to=CDG&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Singapore", basePrice: 260, tag: "Hot Deal", route: "/flights?from=DEL&to=SIN&adults=1&class=Economy" },
  ],
  AE: [
    { emoji: "🏖️", city: "Maldives", basePrice: 760, tag: "Popular", route: "/flights?from=DXB&to=MLE&adults=1&class=Economy" },
    { emoji: "🗼", city: "London", basePrice: 600, tag: "Trending", route: "/flights?from=DXB&to=LHR&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 950, tag: "Dream Trip", route: "/flights?from=DXB&to=NRT&adults=1&class=Economy" },
    { emoji: "🌆", city: "Istanbul", basePrice: 490, tag: "Cheapest", route: "/flights?from=DXB&to=IST&adults=1&class=Economy" },
  ],
  PK: [
    { emoji: "🌆", city: "Dubai", basePrice: 300, tag: "Popular", route: "/flights?from=KHI&to=DXB&adults=1&class=Economy" },
    { emoji: "🕌", city: "Jeddah", basePrice: 420, tag: "Umrah", route: "/flights?from=KHI&to=JED&adults=1&class=Economy" },
    { emoji: "🗼", city: "Istanbul", basePrice: 340, tag: "Trending", route: "/flights?from=KHI&to=IST&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 260, tag: "Cheapest", route: "/flights?from=KHI&to=BKK&adults=1&class=Economy" },
  ],
  GB: [
    { emoji: "🗼", city: "Paris", basePrice: 110, tag: "Cheapest", route: "/flights?from=LHR&to=CDG&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 410, tag: "Popular", route: "/flights?from=LHR&to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 620, tag: "Dream Trip", route: "/flights?from=LHR&to=DPS&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 670, tag: "Trending", route: "/flights?from=LHR&to=NRT&adults=1&class=Economy" },
  ],
  DE: [
    { emoji: "🗼", city: "Paris", basePrice: 140, tag: "Cheapest", route: "/flights?from=FRA&to=CDG&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 360, tag: "Popular", route: "/flights?from=FRA&to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 520, tag: "Trending", route: "/flights?from=FRA&to=BKK&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 620, tag: "Dream Trip", route: "/flights?from=FRA&to=NRT&adults=1&class=Economy" },
  ],
  FR: [
    { emoji: "🌆", city: "Dubai", basePrice: 340, tag: "Popular", route: "/flights?from=CDG&to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 500, tag: "Trending", route: "/flights?from=CDG&to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Rome", basePrice: 120, tag: "Cheapest", route: "/flights?from=CDG&to=FCO&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 610, tag: "Dream Trip", route: "/flights?from=CDG&to=NRT&adults=1&class=Economy" },
  ],
  US: [
    { emoji: "🗼", city: "Paris", basePrice: 380, tag: "Popular", route: "/flights?from=JFK&to=CDG&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Cancun", basePrice: 220, tag: "Cheapest", route: "/flights?from=JFK&to=CUN&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 650, tag: "Dream Trip", route: "/flights?from=JFK&to=NRT&adults=1&class=Economy" },
    { emoji: "🌆", city: "London", basePrice: 420, tag: "Trending", route: "/flights?from=JFK&to=LHR&adults=1&class=Economy" },
  ],
  SA: [
    { emoji: "🌆", city: "Dubai", basePrice: 175, tag: "Popular", route: "/flights?from=RUH&to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Maldives", basePrice: 860, tag: "Dream Trip", route: "/flights?from=RUH&to=MLE&adults=1&class=Economy" },
    { emoji: "🗼", city: "London", basePrice: 750, tag: "Trending", route: "/flights?from=RUH&to=LHR&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Istanbul", basePrice: 400, tag: "Cheapest", route: "/flights?from=RUH&to=IST&adults=1&class=Economy" },
  ],
  MY: [
    { emoji: "⛩️", city: "Singapore", basePrice: 40, tag: "Cheapest", route: "/flights?from=KUL&to=SIN&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 145, tag: "Trending", route: "/flights?from=KUL&to=DPS&adults=1&class=Economy" },
    { emoji: "🗼", city: "Tokyo", basePrice: 490, tag: "Dream Trip", route: "/flights?from=KUL&to=NRT&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 400, tag: "Popular", route: "/flights?from=KUL&to=DXB&adults=1&class=Economy" },
  ],
  DEFAULT: [
    { emoji: "🗼", city: "Paris", basePrice: 680, tag: "Popular", route: "/flights?to=CDG&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 520, tag: "Trending", route: "/flights?to=DPS&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 780, tag: "Dream Trip", route: "/flights?to=NRT&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 450, tag: "Hot Deal", route: "/flights?to=DXB&adults=1&class=Economy" },
  ],
};

export const geoQuickPicks: Record<string, { emoji: string; label: string; from: string; to: string; type: string }[]> = {
  BD: [
    { emoji: "🟢", label: "Cheapest This Week", from: "DAC", to: "DXB", type: "cheap" },
    { emoji: "🔥", label: "DAC → BKK", from: "DAC", to: "BKK", type: "trending" },
    { emoji: "🔥", label: "DAC → KUL", from: "DAC", to: "KUL", type: "trending" },
    { emoji: "✈️", label: "DAC → SIN", from: "DAC", to: "SIN", type: "popular" },
  ],
  IN: [
    { emoji: "🟢", label: "Cheapest This Week", from: "DEL", to: "DXB", type: "cheap" },
    { emoji: "🔥", label: "DEL → BKK", from: "DEL", to: "BKK", type: "trending" },
    { emoji: "🔥", label: "BOM → SIN", from: "BOM", to: "SIN", type: "trending" },
    { emoji: "✈️", label: "DEL → LHR", from: "DEL", to: "LHR", type: "popular" },
  ],
  AE: [
    { emoji: "🟢", label: "Cheapest This Week", from: "DXB", to: "MLE", type: "cheap" },
    { emoji: "🔥", label: "DXB → LHR", from: "DXB", to: "LHR", type: "trending" },
    { emoji: "🔥", label: "DXB → IST", from: "DXB", to: "IST", type: "trending" },
    { emoji: "✈️", label: "DXB → NRT", from: "DXB", to: "NRT", type: "popular" },
  ],
  PK: [
    { emoji: "🟢", label: "Cheapest This Week", from: "KHI", to: "DXB", type: "cheap" },
    { emoji: "🔥", label: "LHE → JED", from: "LHE", to: "JED", type: "trending" },
    { emoji: "🔥", label: "ISB → IST", from: "ISB", to: "IST", type: "trending" },
    { emoji: "✈️", label: "KHI → BKK", from: "KHI", to: "BKK", type: "popular" },
  ],
  GB: [
    { emoji: "🟢", label: "Cheapest This Week", from: "LHR", to: "CDG", type: "cheap" },
    { emoji: "🔥", label: "LHR → DXB", from: "LHR", to: "DXB", type: "trending" },
    { emoji: "🔥", label: "LHR → JFK", from: "LHR", to: "JFK", type: "trending" },
    { emoji: "✈️", label: "LHR → NRT", from: "LHR", to: "NRT", type: "popular" },
  ],
  DE: [
    { emoji: "🟢", label: "Cheapest This Week", from: "FRA", to: "CDG", type: "cheap" },
    { emoji: "🔥", label: "FRA → DXB", from: "FRA", to: "DXB", type: "trending" },
    { emoji: "🔥", label: "MUC → BKK", from: "MUC", to: "BKK", type: "trending" },
    { emoji: "✈️", label: "BER → NRT", from: "BER", to: "NRT", type: "popular" },
  ],
  FR: [
    { emoji: "🟢", label: "Cheapest This Week", from: "CDG", to: "FCO", type: "cheap" },
    { emoji: "🔥", label: "CDG → DXB", from: "CDG", to: "DXB", type: "trending" },
    { emoji: "🔥", label: "ORY → BKK", from: "ORY", to: "BKK", type: "trending" },
    { emoji: "✈️", label: "CDG → NRT", from: "CDG", to: "NRT", type: "popular" },
  ],
  US: [
    { emoji: "🟢", label: "Cheapest This Week", from: "JFK", to: "CUN", type: "cheap" },
    { emoji: "🔥", label: "JFK → CDG", from: "JFK", to: "CDG", type: "trending" },
    { emoji: "🔥", label: "LAX → NRT", from: "LAX", to: "NRT", type: "trending" },
    { emoji: "✈️", label: "JFK → LHR", from: "JFK", to: "LHR", type: "popular" },
  ],
  DEFAULT: [
    { emoji: "🟢", label: "Cheapest This Week", from: "JFK", to: "LHR", type: "cheap" },
    { emoji: "🔥", label: "Top Trending Route", from: "LHR", to: "DXB", type: "trending" },
    { emoji: "🔥", label: "Most Booked", from: "SIN", to: "BKK", type: "trending" },
    { emoji: "✈️", label: "Dream Destination", from: "JFK", to: "NRT", type: "popular" },
  ],
};

export const geoPriceTeasers: Record<string, { emoji: string; text: string; basePrice: number; suffix?: string; href: string }[]> = {
  BD: [
    { emoji: "✈️", text: "Dhaka → Dubai", basePrice: 380, href: "/flights?from=DAC&to=DXB&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Bangkok", basePrice: 28, suffix: "/night", href: "/hotels?location=Bangkok" },
    { emoji: "🎯", text: "Bali Tour Package", basePrice: 440, href: "/tours?destination=Bali" },
    { emoji: "🗼", text: "Singapore Activities", basePrice: 15, href: "/tours?destination=Singapore" },
  ],
  IN: [
    { emoji: "✈️", text: "Delhi → Dubai", basePrice: 210, href: "/flights?from=DEL&to=DXB&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Bangkok", basePrice: 30, suffix: "/night", href: "/hotels?location=Bangkok" },
    { emoji: "🎯", text: "Bali Tour Package", basePrice: 530, href: "/tours?destination=Bali" },
    { emoji: "🗼", text: "Paris Activities", basePrice: 18, href: "/tours?destination=Paris" },
  ],
  AE: [
    { emoji: "✈️", text: "Dubai → Maldives", basePrice: 760, href: "/flights?from=DXB&to=MLE&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in London", basePrice: 120, suffix: "/night", href: "/hotels?location=London" },
    { emoji: "🎯", text: "Istanbul Tour", basePrice: 870, href: "/tours?destination=Istanbul" },
    { emoji: "🗼", text: "Tokyo Activities", basePrice: 75, href: "/tours?destination=Tokyo" },
  ],
  GB: [
    { emoji: "✈️", text: "London → Paris", basePrice: 110, href: "/flights?from=LHR&to=CDG&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Dubai", basePrice: 155, suffix: "/night", href: "/hotels?location=Dubai" },
    { emoji: "🎯", text: "Bali Tour Package", basePrice: 620, href: "/tours?destination=Bali" },
    { emoji: "🗼", text: "Tokyo Activities", basePrice: 45, href: "/tours?destination=Tokyo" },
  ],
  DE: [
    { emoji: "✈️", text: "Frankfurt → Dubai", basePrice: 360, href: "/flights?from=FRA&to=DXB&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Paris", basePrice: 145, suffix: "/night", href: "/hotels?location=Paris" },
    { emoji: "🎯", text: "Bangkok Tour Package", basePrice: 710, href: "/tours?destination=Bangkok" },
    { emoji: "🗼", text: "Rome Activities", basePrice: 35, href: "/tours?destination=Rome" },
  ],
  FR: [
    { emoji: "✈️", text: "Paris → Dubai", basePrice: 340, href: "/flights?from=CDG&to=DXB&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Rome", basePrice: 125, suffix: "/night", href: "/hotels?location=Rome" },
    { emoji: "🎯", text: "Bangkok Tour Package", basePrice: 690, href: "/tours?destination=Bangkok" },
    { emoji: "🗼", text: "Tokyo Activities", basePrice: 40, href: "/tours?destination=Tokyo" },
  ],
  US: [
    { emoji: "✈️", text: "NYC → Paris", basePrice: 380, href: "/flights?from=JFK&to=CDG&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Cancun", basePrice: 95, suffix: "/night", href: "/hotels?location=Cancun" },
    { emoji: "🎯", text: "Bali Tour Package", basePrice: 520, href: "/tours?destination=Bali" },
    { emoji: "🗼", text: "Tokyo Activities", basePrice: 45, href: "/tours?destination=Tokyo" },
  ],
  DEFAULT: [
    { emoji: "✈️", text: "Flights to Dubai", basePrice: 450, href: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🏨", text: "Hotels in Bangkok", basePrice: 45, suffix: "/night", href: "/hotels?location=Bangkok" },
    { emoji: "🎯", text: "Bali Tour Package", basePrice: 520, href: "/tours?destination=Bali" },
    { emoji: "🗼", text: "Paris Activities", basePrice: 25, href: "/tours?destination=Paris" },
  ],
};

export const cardPositions = [
  { pos: "top-20 right-4 xl:right-16 2xl:right-24", delay: 1.2, driftY: [0, -8, 0], driftR: [0, 1, 0], depth: "back" as const },
  { pos: "bottom-72 left-0 xl:left-8 2xl:left-20", delay: 1.6, driftY: [0, 6, 0], driftR: [0, -1, 0], depth: "back" as const },
  { pos: "top-[55%] -right-4 xl:right-4 2xl:right-16", delay: 2.0, driftY: [0, -6, 0], driftR: [0, 0.8, 0], depth: "back" as const },
  { pos: "bottom-20 -left-4 xl:left-4 2xl:left-16", delay: 2.3, driftY: [0, 8, 0], driftR: [0, -0.8, 0], depth: "back" as const },
];

export const cityEmojiMap: Record<string, string> = {
  Dubai: "🌆", Bangkok: "🏖️", "Kuala Lumpur": "🗼", Singapore: "⛩️", Paris: "🗼",
  Bali: "🏖️", Tokyo: "⛩️", London: "🌆", Maldives: "🏖️", Istanbul: "🌆",
  Jeddah: "🕌", Cancun: "🏖️", Delhi: "🕌", Mumbai: "🌆", Dhaka: "🌆",
  Chongqing: "🌆", Kolkata: "🌆", Guangzhou: "🌆", Chittagong: "🏖️",
  "Cox's Bazar": "🏖️",
};

export const iataToCity: Record<string, string> = {
  DXB: "Dubai", BKK: "Bangkok", KUL: "Kuala Lumpur", SIN: "Singapore",
  CDG: "Paris", NRT: "Tokyo", LHR: "London", MLE: "Maldives",
  IST: "Istanbul", JED: "Jeddah", CUN: "Cancun", DEL: "Delhi",
  BOM: "Mumbai", DAC: "Dhaka", CKG: "Chongqing", CCU: "Kolkata",
  CAN: "Guangzhou", CGP: "Chittagong", CXB: "Cox's Bazar",
  DPS: "Bali", JFK: "New York", LAX: "Los Angeles", ORD: "Chicago",
  RUH: "Riyadh", AUH: "Abu Dhabi", DOH: "Doha", KHI: "Karachi",
  LHE: "Lahore", ISB: "Islamabad", PEN: "Penang",
};

export const tagByIndex = ["Popular", "Trending", "Cheapest", "Hot Deal"];

export const currToUsd: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, BDT: 0.0083, INR: 0.012, CNY: 0.14,
  AED: 0.27, SAR: 0.27, MYR: 0.22, PKR: 0.0036,
};

export const geoOrigins: Record<string, string[]> = {
  BD: ["DAC", "CGP", "ZYL"], IN: ["DEL", "BOM", "BLR", "CCU"], AE: ["DXB", "AUH", "SHJ"],
  PK: ["KHI", "LHE", "ISB"], GB: ["LHR", "LGW", "MAN"], US: ["JFK", "LAX", "ORD", "SFO"],
  SA: ["RUH", "JED", "DMM"], MY: ["KUL", "PEN"], DE: ["FRA", "MUC", "BER"], FR: ["CDG", "ORY", "LYS"],
};
