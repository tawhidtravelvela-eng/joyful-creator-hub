/**
 * Centralized geo-destination mapping for ALL countries.
 * Countries are grouped by region; each region has:
 *  - primary hub airports
 *  - popular destination cards (for hero)
 *  - hotel destination pools
 *  - flight price fallbacks for budget explorer
 *  - quick-pick routes
 *
 * Individual country overrides can be specified; unmapped countries
 * fall back to their region, and unknown regions fall back to GLOBAL.
 */

// ── Region definitions ──────────────────────────────────────────

export type GeoRegion =
  | "SOUTH_ASIA"
  | "SOUTHEAST_ASIA"
  | "EAST_ASIA"
  | "MIDDLE_EAST"
  | "EUROPE_WEST"
  | "EUROPE_EAST"
  | "NORTH_AMERICA"
  | "LATIN_AMERICA"
  | "AFRICA"
  | "OCEANIA"
  | "CENTRAL_ASIA"
  | "GLOBAL";

// ── Country → region mapping (ISO 3166-1 alpha-2) ───────────────

export const COUNTRY_TO_REGION: Record<string, GeoRegion> = {
  // South Asia
  BD: "SOUTH_ASIA", IN: "SOUTH_ASIA", PK: "SOUTH_ASIA", LK: "SOUTH_ASIA",
  NP: "SOUTH_ASIA", BT: "SOUTH_ASIA", MV: "SOUTH_ASIA", AF: "SOUTH_ASIA",

  // Southeast Asia
  TH: "SOUTHEAST_ASIA", MY: "SOUTHEAST_ASIA", SG: "SOUTHEAST_ASIA", ID: "SOUTHEAST_ASIA",
  PH: "SOUTHEAST_ASIA", VN: "SOUTHEAST_ASIA", KH: "SOUTHEAST_ASIA", MM: "SOUTHEAST_ASIA",
  LA: "SOUTHEAST_ASIA", BN: "SOUTHEAST_ASIA", TL: "SOUTHEAST_ASIA",

  // East Asia
  CN: "EAST_ASIA", JP: "EAST_ASIA", KR: "EAST_ASIA", HK: "EAST_ASIA",
  TW: "EAST_ASIA", MO: "EAST_ASIA", MN: "EAST_ASIA",

  // Middle East
  AE: "MIDDLE_EAST", SA: "MIDDLE_EAST", QA: "MIDDLE_EAST", KW: "MIDDLE_EAST",
  BH: "MIDDLE_EAST", OM: "MIDDLE_EAST", JO: "MIDDLE_EAST", LB: "MIDDLE_EAST",
  IQ: "MIDDLE_EAST", IR: "MIDDLE_EAST", IL: "MIDDLE_EAST", PS: "MIDDLE_EAST",
  YE: "MIDDLE_EAST", SY: "MIDDLE_EAST",

  // Western Europe
  GB: "EUROPE_WEST", DE: "EUROPE_WEST", FR: "EUROPE_WEST", IT: "EUROPE_WEST",
  ES: "EUROPE_WEST", PT: "EUROPE_WEST", NL: "EUROPE_WEST", BE: "EUROPE_WEST",
  CH: "EUROPE_WEST", AT: "EUROPE_WEST", IE: "EUROPE_WEST", LU: "EUROPE_WEST",
  SE: "EUROPE_WEST", NO: "EUROPE_WEST", DK: "EUROPE_WEST", FI: "EUROPE_WEST",
  IS: "EUROPE_WEST", GR: "EUROPE_WEST", MT: "EUROPE_WEST", CY: "EUROPE_WEST",

  // Eastern Europe
  TR: "EUROPE_EAST", RU: "EUROPE_EAST", UA: "EUROPE_EAST", PL: "EUROPE_EAST",
  CZ: "EUROPE_EAST", RO: "EUROPE_EAST", HU: "EUROPE_EAST", BG: "EUROPE_EAST",
  RS: "EUROPE_EAST", HR: "EUROPE_EAST", SK: "EUROPE_EAST", SI: "EUROPE_EAST",
  BA: "EUROPE_EAST", ME: "EUROPE_EAST", MK: "EUROPE_EAST", AL: "EUROPE_EAST",
  LT: "EUROPE_EAST", LV: "EUROPE_EAST", EE: "EUROPE_EAST", GE: "EUROPE_EAST",
  AM: "EUROPE_EAST", AZ: "EUROPE_EAST", MD: "EUROPE_EAST", BY: "EUROPE_EAST",
  XK: "EUROPE_EAST",

  // North America
  US: "NORTH_AMERICA", CA: "NORTH_AMERICA", MX: "NORTH_AMERICA",

  // Latin America & Caribbean
  BR: "LATIN_AMERICA", AR: "LATIN_AMERICA", CL: "LATIN_AMERICA", CO: "LATIN_AMERICA",
  PE: "LATIN_AMERICA", EC: "LATIN_AMERICA", VE: "LATIN_AMERICA", UY: "LATIN_AMERICA",
  PY: "LATIN_AMERICA", BO: "LATIN_AMERICA", CR: "LATIN_AMERICA", PA: "LATIN_AMERICA",
  DO: "LATIN_AMERICA", CU: "LATIN_AMERICA", GT: "LATIN_AMERICA", HN: "LATIN_AMERICA",
  SV: "LATIN_AMERICA", NI: "LATIN_AMERICA", JM: "LATIN_AMERICA", TT: "LATIN_AMERICA",
  PR: "LATIN_AMERICA", HT: "LATIN_AMERICA", GY: "LATIN_AMERICA", SR: "LATIN_AMERICA",
  BZ: "LATIN_AMERICA", BB: "LATIN_AMERICA", BS: "LATIN_AMERICA",

  // Africa
  EG: "AFRICA", ZA: "AFRICA", NG: "AFRICA", KE: "AFRICA", ET: "AFRICA",
  GH: "AFRICA", TZ: "AFRICA", MA: "AFRICA", TN: "AFRICA", DZ: "AFRICA",
  SN: "AFRICA", CM: "AFRICA", CI: "AFRICA", UG: "AFRICA", MZ: "AFRICA",
  AO: "AFRICA", RW: "AFRICA", MU: "AFRICA", SC: "AFRICA", BW: "AFRICA",
  NA: "AFRICA", ZW: "AFRICA", LY: "AFRICA", SD: "AFRICA", CD: "AFRICA",
  MG: "AFRICA", ML: "AFRICA", NE: "AFRICA", BF: "AFRICA", MW: "AFRICA",
  SO: "AFRICA", ER: "AFRICA", DJ: "AFRICA", GA: "AFRICA", CG: "AFRICA",

  // Oceania
  AU: "OCEANIA", NZ: "OCEANIA", FJ: "OCEANIA", PG: "OCEANIA",
  WS: "OCEANIA", TO: "OCEANIA", VU: "OCEANIA", NC: "OCEANIA",
  PF: "OCEANIA", GU: "OCEANIA",

  // Central Asia
  KZ: "CENTRAL_ASIA", UZ: "CENTRAL_ASIA", KG: "CENTRAL_ASIA",
  TJ: "CENTRAL_ASIA", TM: "CENTRAL_ASIA",
};

// ── Airport hubs per country ────────────────────────────────────

export const COUNTRY_AIRPORTS: Record<string, string[]> = {
  // South Asia
  BD: ["DAC", "CGP", "ZYL", "CXB", "JSR", "RJH", "SPD"],
  IN: ["DEL", "BOM", "BLR", "MAA", "CCU", "HYD", "COK", "AMD", "GOI", "JAI"],
  PK: ["KHI", "ISB", "LHE", "PEW", "MUX"],
  LK: ["CMB"],
  NP: ["KTM"],
  MV: ["MLE"],
  BT: ["PBH"],
  // Southeast Asia
  TH: ["BKK", "DMK", "HKT", "CNX", "USM"],
  MY: ["KUL", "PEN", "BKI", "KCH", "LGK"],
  SG: ["SIN"],
  ID: ["CGK", "DPS", "SUB", "UPG", "JOG"],
  PH: ["MNL", "CEB", "DVO", "CRK"],
  VN: ["SGN", "HAN", "DAD", "CXR"],
  KH: ["PNH", "REP"],
  MM: ["RGN", "MDL"],
  LA: ["VTE", "LPQ"],
  BN: ["BWN"],
  // East Asia
  CN: ["PVG", "PEK", "CAN", "CTU", "SZX", "KMG", "XIY", "WUH", "CKG", "HGH"],
  JP: ["NRT", "HND", "KIX", "NGO", "FUK", "CTS", "OKA"],
  KR: ["ICN", "GMP", "PUS", "CJU"],
  HK: ["HKG"],
  TW: ["TPE", "KHH"],
  // Middle East
  AE: ["DXB", "AUH", "SHJ"],
  SA: ["JED", "RUH", "DMM", "MED"],
  QA: ["DOH"],
  KW: ["KWI"],
  BH: ["BAH"],
  OM: ["MCT", "SLL"],
  JO: ["AMM", "AQJ"],
  LB: ["BEY"],
  IQ: ["BGW", "EBL", "BSR"],
  IR: ["IKA", "THR", "MHD", "ISF"],
  IL: ["TLV"],
  // Western Europe
  GB: ["LHR", "LGW", "MAN", "STN", "EDI", "BHX", "BRS", "GLA"],
  DE: ["FRA", "MUC", "BER", "DUS", "HAM", "CGN", "STR"],
  FR: ["CDG", "ORY", "NCE", "LYS", "MRS", "TLS"],
  IT: ["FCO", "MXP", "VCE", "NAP", "BGY", "BLQ"],
  ES: ["MAD", "BCN", "PMI", "AGP", "ALC", "VLC"],
  PT: ["LIS", "OPO", "FAO"],
  NL: ["AMS", "EIN"],
  BE: ["BRU", "CRL"],
  CH: ["ZRH", "GVA", "BSL"],
  AT: ["VIE", "SZG"],
  IE: ["DUB", "SNN", "ORK"],
  SE: ["ARN", "GOT"],
  NO: ["OSL", "BGO", "TRD"],
  DK: ["CPH", "BLL"],
  FI: ["HEL"],
  GR: ["ATH", "SKG", "HER", "RHO", "CFU", "JMK"],
  IS: ["KEF"],
  // Eastern Europe
  TR: ["IST", "SAW", "ESB", "ADB", "AYT", "ADA"],
  RU: ["SVO", "DME", "LED", "VKO"],
  UA: ["KBP", "ODS", "LWO"],
  PL: ["WAW", "KRK", "GDN", "WRO"],
  CZ: ["PRG"],
  RO: ["OTP", "CLJ"],
  HU: ["BUD"],
  BG: ["SOF", "BOJ", "VAR"],
  RS: ["BEG"],
  HR: ["ZAG", "SPU", "DBV"],
  GE: ["TBS", "BUS"],
  // North America
  US: ["JFK", "LAX", "ORD", "SFO", "MIA", "ATL", "DFW", "SEA", "BOS", "IAD", "DEN", "IAH", "EWR"],
  CA: ["YYZ", "YVR", "YUL", "YOW", "YYC", "YEG"],
  MX: ["MEX", "CUN", "GDL", "MTY", "SJD", "PVR"],
  // Latin America
  BR: ["GRU", "GIG", "BSB", "CNF", "SSA", "REC", "FOR"],
  AR: ["EZE", "AEP", "COR", "MDZ"],
  CL: ["SCL"],
  CO: ["BOG", "MDE", "CTG", "CLO"],
  PE: ["LIM", "CUZ"],
  EC: ["UIO", "GYE"],
  PA: ["PTY"],
  CR: ["SJO"],
  DO: ["PUJ", "SDQ"],
  CU: ["HAV", "VRA"],
  // Africa
  EG: ["CAI", "HRG", "SSH", "HBE"],
  ZA: ["JNB", "CPT", "DUR"],
  NG: ["LOS", "ABV"],
  KE: ["NBO", "MBA"],
  ET: ["ADD"],
  GH: ["ACC"],
  TZ: ["DAR", "JRO", "ZNZ"],
  MA: ["CMN", "RAK", "FEZ"],
  TN: ["TUN"],
  MU: ["MRU"],
  SC: ["SEZ"],
  // Oceania
  AU: ["SYD", "MEL", "BNE", "PER", "ADL", "OOL", "CNS"],
  NZ: ["AKL", "WLG", "CHC", "ZQN"],
  FJ: ["NAN", "SUV"],
  // Central Asia
  KZ: ["ALA", "NQZ", "TSE"],
  UZ: ["TAS"],
};

// ── Region-level airport hubs (fallback when country not in COUNTRY_AIRPORTS) ─

const REGION_AIRPORTS: Record<GeoRegion, string[]> = {
  SOUTH_ASIA: ["DEL", "BOM", "DAC", "KHI", "CMB"],
  SOUTHEAST_ASIA: ["SIN", "BKK", "KUL", "CGK", "MNL"],
  EAST_ASIA: ["PVG", "NRT", "ICN", "HKG", "TPE"],
  MIDDLE_EAST: ["DXB", "DOH", "RUH", "JED", "AUH"],
  EUROPE_WEST: ["LHR", "CDG", "FRA", "AMS", "MAD", "FCO"],
  EUROPE_EAST: ["IST", "SVO", "WAW", "PRG", "BUD"],
  NORTH_AMERICA: ["JFK", "LAX", "ORD", "YYZ", "MEX"],
  LATIN_AMERICA: ["GRU", "EZE", "BOG", "LIM", "SCL", "PTY"],
  AFRICA: ["JNB", "CAI", "NBO", "ADD", "CMN", "LOS"],
  OCEANIA: ["SYD", "MEL", "AKL", "BNE", "PER"],
  CENTRAL_ASIA: ["ALA", "TAS", "NQZ"],
  GLOBAL: ["LHR", "DXB", "SIN", "JFK", "NRT"],
};

// ── Popular destination cards per region ─────────────────────────

export interface GeoDestCard {
  emoji: string;
  city: string;
  basePrice: number;
  tag: string;
  route: string;
}

export interface HotelCity {
  id: string;
  city: string;
  country: string;
  image: string;
  avgPrice: string;
  hotelCount: string;
}

export interface QuickPick {
  emoji: string;
  label: string;
  from: string;
  to: string;
  type: string;
}

export interface PriceTeaser {
  emoji: string;
  text: string;
  basePrice: number;
  suffix?: string;
  href: string;
}

// ── Region destination cards ────────────────────────────────────

const REGION_DEST_CARDS: Record<GeoRegion, GeoDestCard[]> = {
  SOUTH_ASIA: [
    { emoji: "🌆", city: "Dubai", basePrice: 340, tag: "Popular", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 220, tag: "Trending", route: "/flights?to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Kuala Lumpur", basePrice: 240, tag: "Cheapest", route: "/flights?to=KUL&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Singapore", basePrice: 300, tag: "Hot Deal", route: "/flights?to=SIN&adults=1&class=Economy" },
  ],
  SOUTHEAST_ASIA: [
    { emoji: "⛩️", city: "Tokyo", basePrice: 380, tag: "Dream Trip", route: "/flights?to=NRT&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 120, tag: "Cheapest", route: "/flights?to=DPS&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 450, tag: "Popular", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🗼", city: "Seoul", basePrice: 320, tag: "Trending", route: "/flights?to=ICN&adults=1&class=Economy" },
  ],
  EAST_ASIA: [
    { emoji: "🏖️", city: "Bangkok", basePrice: 280, tag: "Popular", route: "/flights?to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Singapore", basePrice: 350, tag: "Trending", route: "/flights?to=SIN&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 550, tag: "Hot Deal", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 300, tag: "Cheapest", route: "/flights?to=DPS&adults=1&class=Economy" },
  ],
  MIDDLE_EAST: [
    { emoji: "🗼", city: "London", basePrice: 550, tag: "Popular", route: "/flights?to=LHR&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Maldives", basePrice: 680, tag: "Dream Trip", route: "/flights?to=MLE&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Istanbul", basePrice: 350, tag: "Cheapest", route: "/flights?to=IST&adults=1&class=Economy" },
    { emoji: "🌆", city: "Paris", basePrice: 520, tag: "Trending", route: "/flights?to=CDG&adults=1&class=Economy" },
  ],
  EUROPE_WEST: [
    { emoji: "🌆", city: "Dubai", basePrice: 380, tag: "Popular", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 620, tag: "Dream Trip", route: "/flights?to=DPS&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 650, tag: "Trending", route: "/flights?to=NRT&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 480, tag: "Hot Deal", route: "/flights?to=BKK&adults=1&class=Economy" },
  ],
  EUROPE_EAST: [
    { emoji: "🌆", city: "Dubai", basePrice: 350, tag: "Popular", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🗼", city: "London", basePrice: 180, tag: "Cheapest", route: "/flights?to=LHR&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 450, tag: "Trending", route: "/flights?to=BKK&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Paris", basePrice: 160, tag: "Hot Deal", route: "/flights?to=CDG&adults=1&class=Economy" },
  ],
  NORTH_AMERICA: [
    { emoji: "🗼", city: "Paris", basePrice: 380, tag: "Popular", route: "/flights?to=CDG&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Cancun", basePrice: 220, tag: "Cheapest", route: "/flights?to=CUN&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 650, tag: "Dream Trip", route: "/flights?to=NRT&adults=1&class=Economy" },
    { emoji: "🌆", city: "London", basePrice: 420, tag: "Trending", route: "/flights?to=LHR&adults=1&class=Economy" },
  ],
  LATIN_AMERICA: [
    { emoji: "🗼", city: "Paris", basePrice: 680, tag: "Dream Trip", route: "/flights?to=CDG&adults=1&class=Economy" },
    { emoji: "🌆", city: "Miami", basePrice: 350, tag: "Popular", route: "/flights?to=MIA&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Cancun", basePrice: 280, tag: "Trending", route: "/flights?to=CUN&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Madrid", basePrice: 550, tag: "Cheapest", route: "/flights?to=MAD&adults=1&class=Economy" },
  ],
  AFRICA: [
    { emoji: "🌆", city: "Dubai", basePrice: 420, tag: "Popular", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "🗼", city: "London", basePrice: 480, tag: "Trending", route: "/flights?to=LHR&adults=1&class=Economy" },
    { emoji: "🗼", city: "Paris", basePrice: 450, tag: "Cheapest", route: "/flights?to=CDG&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Istanbul", basePrice: 380, tag: "Hot Deal", route: "/flights?to=IST&adults=1&class=Economy" },
  ],
  OCEANIA: [
    { emoji: "🏖️", city: "Bali", basePrice: 350, tag: "Popular", route: "/flights?to=DPS&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 580, tag: "Trending", route: "/flights?to=NRT&adults=1&class=Economy" },
    { emoji: "🗼", city: "Singapore", basePrice: 400, tag: "Cheapest", route: "/flights?to=SIN&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 720, tag: "Dream Trip", route: "/flights?to=DXB&adults=1&class=Economy" },
  ],
  CENTRAL_ASIA: [
    { emoji: "🌆", city: "Dubai", basePrice: 380, tag: "Popular", route: "/flights?to=DXB&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Istanbul", basePrice: 250, tag: "Cheapest", route: "/flights?to=IST&adults=1&class=Economy" },
    { emoji: "🗼", city: "Moscow", basePrice: 200, tag: "Trending", route: "/flights?to=SVO&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 520, tag: "Dream Trip", route: "/flights?to=BKK&adults=1&class=Economy" },
  ],
  GLOBAL: [
    { emoji: "🗼", city: "Paris", basePrice: 680, tag: "Popular", route: "/flights?to=CDG&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 520, tag: "Trending", route: "/flights?to=DPS&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 780, tag: "Dream Trip", route: "/flights?to=NRT&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 450, tag: "Hot Deal", route: "/flights?to=DXB&adults=1&class=Economy" },
  ],
};

// ── Country-specific overrides (keep existing fine-tuned data) ──

const COUNTRY_DEST_CARDS: Partial<Record<string, GeoDestCard[]>> = {
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
  AU: [
    { emoji: "🏖️", city: "Bali", basePrice: 280, tag: "Popular", route: "/flights?from=SYD&to=DPS&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 520, tag: "Trending", route: "/flights?from=SYD&to=NRT&adults=1&class=Economy" },
    { emoji: "🗼", city: "Singapore", basePrice: 350, tag: "Cheapest", route: "/flights?from=SYD&to=SIN&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 680, tag: "Dream Trip", route: "/flights?from=SYD&to=DXB&adults=1&class=Economy" },
  ],
  JP: [
    { emoji: "🏖️", city: "Bangkok", basePrice: 280, tag: "Popular", route: "/flights?from=NRT&to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Seoul", basePrice: 160, tag: "Cheapest", route: "/flights?from=NRT&to=ICN&adults=1&class=Economy" },
    { emoji: "🌆", city: "Singapore", basePrice: 400, tag: "Trending", route: "/flights?from=NRT&to=SIN&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bali", basePrice: 380, tag: "Hot Deal", route: "/flights?from=NRT&to=DPS&adults=1&class=Economy" },
  ],
  KR: [
    { emoji: "⛩️", city: "Tokyo", basePrice: 180, tag: "Cheapest", route: "/flights?from=ICN&to=NRT&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 250, tag: "Popular", route: "/flights?from=ICN&to=BKK&adults=1&class=Economy" },
    { emoji: "🗼", city: "Singapore", basePrice: 380, tag: "Trending", route: "/flights?from=ICN&to=SIN&adults=1&class=Economy" },
    { emoji: "🌆", city: "Dubai", basePrice: 620, tag: "Dream Trip", route: "/flights?from=ICN&to=DXB&adults=1&class=Economy" },
  ],
  EG: [
    { emoji: "🌆", city: "Dubai", basePrice: 320, tag: "Popular", route: "/flights?from=CAI&to=DXB&adults=1&class=Economy" },
    { emoji: "🗼", city: "Istanbul", basePrice: 220, tag: "Cheapest", route: "/flights?from=CAI&to=IST&adults=1&class=Economy" },
    { emoji: "🏖️", city: "London", basePrice: 420, tag: "Trending", route: "/flights?from=CAI&to=LHR&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Paris", basePrice: 380, tag: "Dream Trip", route: "/flights?from=CAI&to=CDG&adults=1&class=Economy" },
  ],
  NG: [
    { emoji: "🌆", city: "Dubai", basePrice: 580, tag: "Popular", route: "/flights?from=LOS&to=DXB&adults=1&class=Economy" },
    { emoji: "🗼", city: "London", basePrice: 520, tag: "Trending", route: "/flights?from=LOS&to=LHR&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Istanbul", basePrice: 450, tag: "Cheapest", route: "/flights?from=LOS&to=IST&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Accra", basePrice: 280, tag: "Hot Deal", route: "/flights?from=LOS&to=ACC&adults=1&class=Economy" },
  ],
  TR: [
    { emoji: "🌆", city: "Dubai", basePrice: 280, tag: "Popular", route: "/flights?from=IST&to=DXB&adults=1&class=Economy" },
    { emoji: "🗼", city: "London", basePrice: 200, tag: "Cheapest", route: "/flights?from=IST&to=LHR&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Bangkok", basePrice: 480, tag: "Dream Trip", route: "/flights?from=IST&to=BKK&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Paris", basePrice: 180, tag: "Trending", route: "/flights?from=IST&to=CDG&adults=1&class=Economy" },
  ],
  CA: [
    { emoji: "🗼", city: "Paris", basePrice: 450, tag: "Popular", route: "/flights?from=YYZ&to=CDG&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Cancun", basePrice: 280, tag: "Cheapest", route: "/flights?from=YYZ&to=CUN&adults=1&class=Economy" },
    { emoji: "🌆", city: "London", basePrice: 380, tag: "Trending", route: "/flights?from=YYZ&to=LHR&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Tokyo", basePrice: 680, tag: "Dream Trip", route: "/flights?from=YYZ&to=NRT&adults=1&class=Economy" },
  ],
  BR: [
    { emoji: "🗼", city: "Paris", basePrice: 720, tag: "Dream Trip", route: "/flights?from=GRU&to=CDG&adults=1&class=Economy" },
    { emoji: "🌆", city: "Miami", basePrice: 450, tag: "Popular", route: "/flights?from=GRU&to=MIA&adults=1&class=Economy" },
    { emoji: "🏖️", city: "Cancun", basePrice: 380, tag: "Trending", route: "/flights?from=GRU&to=CUN&adults=1&class=Economy" },
    { emoji: "⛩️", city: "Lisbon", basePrice: 520, tag: "Cheapest", route: "/flights?from=GRU&to=LIS&adults=1&class=Economy" },
  ],
};

// ── Hotel destinations per region ───────────────────────────────

const REGION_HOTEL_DESTS: Record<GeoRegion, HotelCity[]> = {
  SOUTH_ASIA: [
    { id: "h1", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h2", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h3", city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { id: "h4", city: "Singapore", country: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", avgPrice: "$120", hotelCount: "1,500+" },
    { id: "h5", city: "Kuala Lumpur", country: "Malaysia", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&q=80", avgPrice: "$55", hotelCount: "2,100+" },
  ],
  SOUTHEAST_ASIA: [
    { id: "h1", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h2", city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { id: "h3", city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", avgPrice: "$95", hotelCount: "3,800+" },
    { id: "h4", city: "Singapore", country: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", avgPrice: "$120", hotelCount: "1,500+" },
    { id: "h5", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
  ],
  EAST_ASIA: [
    { id: "h1", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h2", city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { id: "h3", city: "Singapore", country: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", avgPrice: "$120", hotelCount: "1,500+" },
    { id: "h4", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h5", city: "Seoul", country: "South Korea", image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80", avgPrice: "$75", hotelCount: "2,500+" },
  ],
  MIDDLE_EAST: [
    { id: "h1", city: "London", country: "UK", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80", avgPrice: "$150", hotelCount: "5,200+" },
    { id: "h2", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$140", hotelCount: "4,500+" },
    { id: "h3", city: "Istanbul", country: "Turkey", image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80", avgPrice: "$65", hotelCount: "3,100+" },
    { id: "h4", city: "Maldives", country: "Maldives", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80", avgPrice: "$250", hotelCount: "800+" },
    { id: "h5", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
  ],
  EUROPE_WEST: [
    { id: "h1", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h2", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h3", city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { id: "h4", city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", avgPrice: "$95", hotelCount: "3,800+" },
    { id: "h5", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$150", hotelCount: "4,500+" },
  ],
  EUROPE_EAST: [
    { id: "h1", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h2", city: "Istanbul", country: "Turkey", image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80", avgPrice: "$65", hotelCount: "3,100+" },
    { id: "h3", city: "London", country: "UK", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80", avgPrice: "$150", hotelCount: "5,200+" },
    { id: "h4", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$140", hotelCount: "4,500+" },
    { id: "h5", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
  ],
  NORTH_AMERICA: [
    { id: "h1", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$150", hotelCount: "4,500+" },
    { id: "h2", city: "London", country: "UK", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80", avgPrice: "$150", hotelCount: "5,200+" },
    { id: "h3", city: "Cancun", country: "Mexico", image: "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=600&q=80", avgPrice: "$95", hotelCount: "2,800+" },
    { id: "h4", city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", avgPrice: "$95", hotelCount: "3,800+" },
    { id: "h5", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
  ],
  LATIN_AMERICA: [
    { id: "h1", city: "Cancun", country: "Mexico", image: "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=600&q=80", avgPrice: "$95", hotelCount: "2,800+" },
    { id: "h2", city: "Miami", country: "USA", image: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=600&q=80", avgPrice: "$130", hotelCount: "3,500+" },
    { id: "h3", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$150", hotelCount: "4,500+" },
    { id: "h4", city: "Madrid", country: "Spain", image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&q=80", avgPrice: "$100", hotelCount: "3,200+" },
    { id: "h5", city: "Lisbon", country: "Portugal", image: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=600&q=80", avgPrice: "$80", hotelCount: "2,100+" },
  ],
  AFRICA: [
    { id: "h1", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h2", city: "Istanbul", country: "Turkey", image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80", avgPrice: "$65", hotelCount: "3,100+" },
    { id: "h3", city: "London", country: "UK", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80", avgPrice: "$150", hotelCount: "5,200+" },
    { id: "h4", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$140", hotelCount: "4,500+" },
    { id: "h5", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
  ],
  OCEANIA: [
    { id: "h1", city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { id: "h2", city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", avgPrice: "$95", hotelCount: "3,800+" },
    { id: "h3", city: "Singapore", country: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", avgPrice: "$120", hotelCount: "1,500+" },
    { id: "h4", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h5", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
  ],
  CENTRAL_ASIA: [
    { id: "h1", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h2", city: "Istanbul", country: "Turkey", image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80", avgPrice: "$65", hotelCount: "3,100+" },
    { id: "h3", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h4", city: "Moscow", country: "Russia", image: "https://images.unsplash.com/photo-1513326738677-b964603b136d?w=600&q=80", avgPrice: "$70", hotelCount: "2,800+" },
    { id: "h5", city: "Seoul", country: "South Korea", image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80", avgPrice: "$75", hotelCount: "2,500+" },
  ],
  GLOBAL: [
    { id: "h1", city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { id: "h2", city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { id: "h3", city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { id: "h4", city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$150", hotelCount: "4,500+" },
    { id: "h5", city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", avgPrice: "$95", hotelCount: "3,800+" },
  ],
};

// ── Budget explorer flight fallbacks per region ─────────────────

const BUDGET_DEST_IATAS = ["BKK", "CCU", "KTM", "KUL", "DPS", "DXB", "SIN", "CMB", "CAN", "HKT"];

const REGION_FLIGHT_FALLBACKS: Record<GeoRegion, Record<string, number>> = {
  SOUTH_ASIA:     { BKK: 180, CCU: 55, KTM: 110, KUL: 220, DPS: 300, DXB: 320, SIN: 250, CMB: 130, CAN: 240, HKT: 200 },
  SOUTHEAST_ASIA: { BKK: 50, CCU: 180, KTM: 220, KUL: 60, DPS: 90, DXB: 400, SIN: 40, CMB: 200, CAN: 130, HKT: 55 },
  EAST_ASIA:      { BKK: 250, CCU: 300, KTM: 350, KUL: 230, DPS: 280, DXB: 550, SIN: 300, CMB: 350, CAN: 100, HKT: 260 },
  MIDDLE_EAST:    { BKK: 330, CCU: 260, KTM: 300, KUL: 350, DPS: 400, DXB: 0, SIN: 370, CMB: 280, CAN: 420, HKT: 350 },
  EUROPE_WEST:    { BKK: 480, CCU: 500, KTM: 520, KUL: 460, DPS: 580, DXB: 360, SIN: 500, CMB: 480, CAN: 540, HKT: 490 },
  EUROPE_EAST:    { BKK: 420, CCU: 440, KTM: 460, KUL: 400, DPS: 520, DXB: 300, SIN: 440, CMB: 420, CAN: 480, HKT: 430 },
  NORTH_AMERICA:  { BKK: 480, CCU: 520, KTM: 560, KUL: 460, DPS: 500, DXB: 560, SIN: 490, CMB: 520, CAN: 440, HKT: 500 },
  LATIN_AMERICA:  { BKK: 680, CCU: 700, KTM: 720, KUL: 660, DPS: 700, DXB: 720, SIN: 680, CMB: 700, CAN: 640, HKT: 690 },
  AFRICA:         { BKK: 520, CCU: 480, KTM: 540, KUL: 500, DPS: 560, DXB: 380, SIN: 520, CMB: 460, CAN: 560, HKT: 530 },
  OCEANIA:        { BKK: 380, CCU: 520, KTM: 560, KUL: 350, DPS: 280, DXB: 680, SIN: 350, CMB: 520, CAN: 400, HKT: 390 },
  CENTRAL_ASIA:   { BKK: 450, CCU: 380, KTM: 400, KUL: 430, DPS: 500, DXB: 350, SIN: 460, CMB: 400, CAN: 400, HKT: 460 },
  GLOBAL:         { BKK: 450, CCU: 480, KTM: 500, KUL: 430, DPS: 500, DXB: 450, SIN: 460, CMB: 480, CAN: 450, HKT: 470 },
};

// ── Country name mapping ────────────────────────────────────────

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AR: "Argentina", AU: "Australia",
  AT: "Austria", AZ: "Azerbaijan", BH: "Bahrain", BD: "Bangladesh", BY: "Belarus",
  BE: "Belgium", BT: "Bhutan", BO: "Bolivia", BA: "Bosnia", BW: "Botswana",
  BR: "Brazil", BN: "Brunei", BG: "Bulgaria", KH: "Cambodia", CM: "Cameroon",
  CA: "Canada", CL: "Chile", CN: "China", CO: "Colombia", CR: "Costa Rica",
  HR: "Croatia", CU: "Cuba", CY: "Cyprus", CZ: "Czechia", DK: "Denmark",
  DJ: "Djibouti", DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt",
  SV: "El Salvador", ER: "Eritrea", EE: "Estonia", ET: "Ethiopia", FJ: "Fiji",
  FI: "Finland", FR: "France", GA: "Gabon", GE: "Georgia", DE: "Germany",
  GH: "Ghana", GR: "Greece", GT: "Guatemala", GY: "Guyana", HT: "Haiti",
  HN: "Honduras", HK: "Hong Kong", HU: "Hungary", IS: "Iceland", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland", IL: "Israel",
  IT: "Italy", JM: "Jamaica", JP: "Japan", JO: "Jordan", KZ: "Kazakhstan",
  KE: "Kenya", KW: "Kuwait", KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia",
  LB: "Lebanon", LY: "Libya", LT: "Lithuania", LU: "Luxembourg", MO: "Macau",
  MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives", ML: "Mali",
  MT: "Malta", MU: "Mauritius", MX: "Mexico", MD: "Moldova", MN: "Mongolia",
  ME: "Montenegro", MA: "Morocco", MZ: "Mozambique", MM: "Myanmar", NA: "Namibia",
  NP: "Nepal", NL: "Netherlands", NZ: "New Zealand", NI: "Nicaragua", NE: "Niger",
  NG: "Nigeria", MK: "North Macedonia", NO: "Norway", OM: "Oman", PK: "Pakistan",
  PA: "Panama", PG: "Papua New Guinea", PY: "Paraguay", PE: "Peru", PH: "Philippines",
  PL: "Poland", PT: "Portugal", PR: "Puerto Rico", QA: "Qatar", RO: "Romania",
  RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia", SN: "Senegal", RS: "Serbia",
  SC: "Seychelles", SG: "Singapore", SK: "Slovakia", SI: "Slovenia", SO: "Somalia",
  ZA: "South Africa", KR: "South Korea", ES: "Spain", LK: "Sri Lanka", SD: "Sudan",
  SR: "Suriname", SE: "Sweden", CH: "Switzerland", SY: "Syria", TW: "Taiwan",
  TJ: "Tajikistan", TZ: "Tanzania", TH: "Thailand", TL: "Timor-Leste",
  TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan", UG: "Uganda", UA: "Ukraine",
  AE: "United Arab Emirates", GB: "United Kingdom", US: "United States",
  UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
  ZM: "Zambia", ZW: "Zimbabwe",
};

// ── Public API functions ────────────────────────────────────────

/** Get the region for a country code */
export function getRegion(countryCode: string): GeoRegion {
  return COUNTRY_TO_REGION[countryCode] || "GLOBAL";
}

/** Get airport codes for a country (with region fallback) */
export function getAirportsForCountry(countryCode: string): string[] {
  if (COUNTRY_AIRPORTS[countryCode]?.length) return COUNTRY_AIRPORTS[countryCode];
  const region = getRegion(countryCode);
  return REGION_AIRPORTS[region] || REGION_AIRPORTS.GLOBAL;
}

/** Get destination cards for hero section */
export function getDestCards(countryCode: string): GeoDestCard[] {
  if (COUNTRY_DEST_CARDS[countryCode]) return COUNTRY_DEST_CARDS[countryCode]!;
  const region = getRegion(countryCode);
  return REGION_DEST_CARDS[region] || REGION_DEST_CARDS.GLOBAL;
}

/** Get hotel destinations for a country */
export function getHotelDests(countryCode: string): HotelCity[] {
  const region = getRegion(countryCode);
  return REGION_HOTEL_DESTS[region] || REGION_HOTEL_DESTS.GLOBAL;
}

/** Get flight price fallbacks for budget explorer */
export function getFlightFallbacks(countryCode: string): Record<string, number> {
  // Country-specific overrides from the old GEO_FLIGHT_FALLBACKS
  const overrides: Partial<Record<string, Record<string, number>>> = {
    BD: { BKK: 180, CCU: 55, KTM: 110, KUL: 220, DPS: 300, DXB: 320, SIN: 250, CMB: 130, CAN: 240, HKT: 200 },
    IN: { BKK: 150, CCU: 40, KTM: 70, KUL: 170, DPS: 280, DXB: 180, SIN: 220, CMB: 70, CAN: 220, HKT: 170 },
    AE: { BKK: 300, CCU: 240, KTM: 280, KUL: 330, DPS: 370, DXB: 0, SIN: 350, CMB: 260, CAN: 400, HKT: 320 },
    GB: { BKK: 420, CCU: 450, KTM: 480, KUL: 400, DPS: 540, DXB: 360, SIN: 440, CMB: 420, CAN: 480, HKT: 440 },
    US: { BKK: 480, CCU: 520, KTM: 560, KUL: 460, DPS: 500, DXB: 560, SIN: 490, CMB: 520, CAN: 440, HKT: 500 },
    PK: { BKK: 220, CCU: 100, KTM: 150, KUL: 260, DPS: 330, DXB: 260, SIN: 300, CMB: 170, CAN: 280, HKT: 240 },
    MY: { BKK: 70, CCU: 150, KTM: 190, KUL: 0, DPS: 120, DXB: 350, SIN: 35, CMB: 170, CAN: 150, HKT: 75 },
    SA: { BKK: 330, CCU: 260, KTM: 300, KUL: 350, DPS: 400, DXB: 150, SIN: 370, CMB: 280, CAN: 420, HKT: 350 },
    DE: { BKK: 520, CCU: 540, KTM: 560, KUL: 500, DPS: 620, DXB: 360, SIN: 540, CMB: 520, CAN: 580, HKT: 530 },
    FR: { BKK: 500, CCU: 530, KTM: 550, KUL: 490, DPS: 610, DXB: 340, SIN: 520, CMB: 500, CAN: 570, HKT: 520 },
    AU: { BKK: 380, CCU: 520, KTM: 560, KUL: 350, DPS: 280, DXB: 680, SIN: 350, CMB: 520, CAN: 400, HKT: 390 },
    JP: { BKK: 280, CCU: 350, KTM: 400, KUL: 260, DPS: 300, DXB: 580, SIN: 320, CMB: 380, CAN: 150, HKT: 290 },
    KR: { BKK: 260, CCU: 320, KTM: 380, KUL: 240, DPS: 280, DXB: 560, SIN: 300, CMB: 360, CAN: 130, HKT: 270 },
    TR: { BKK: 420, CCU: 380, KTM: 420, KUL: 400, DPS: 480, DXB: 280, SIN: 440, CMB: 380, CAN: 460, HKT: 430 },
    EG: { BKK: 480, CCU: 420, KTM: 460, KUL: 460, DPS: 520, DXB: 320, SIN: 480, CMB: 420, CAN: 500, HKT: 490 },
    NG: { BKK: 600, CCU: 550, KTM: 580, KUL: 580, DPS: 640, DXB: 450, SIN: 600, CMB: 540, CAN: 620, HKT: 610 },
    BR: { BKK: 700, CCU: 720, KTM: 740, KUL: 680, DPS: 720, DXB: 740, SIN: 700, CMB: 720, CAN: 660, HKT: 710 },
    CA: { BKK: 500, CCU: 540, KTM: 580, KUL: 480, DPS: 520, DXB: 580, SIN: 510, CMB: 540, CAN: 460, HKT: 520 },
  };
  if (overrides[countryCode]) return overrides[countryCode]!;
  const region = getRegion(countryCode);
  return REGION_FLIGHT_FALLBACKS[region] || REGION_FLIGHT_FALLBACKS.GLOBAL;
}

/** Get origin airports for budget explorer */
export function getOriginAirports(countryCode: string): string[] {
  return getAirportsForCountry(countryCode);
}

/** Get country name from code */
export function getCountryName(code: string): string {
  return COUNTRY_CODE_TO_NAME[code] || "";
}
