import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HolidayInfo {
  date: string;
  label: string;
  country: string;
  emoji: string;
  mood: "festive" | "solemn" | "national" | "cultural" | "religious";
}

// Common country name → ISO code mapping (covers most travel destinations)
const COUNTRY_CODE_MAP: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "argentina": "AR", "australia": "AU",
  "austria": "AT", "azerbaijan": "AZ", "bahamas": "BS", "bahrain": "BH", "bangladesh": "BD",
  "barbados": "BB", "belgium": "BE", "bhutan": "BT", "bolivia": "BO", "brazil": "BR",
  "brunei": "BN", "bulgaria": "BG", "cambodia": "KH", "cameroon": "CM", "canada": "CA",
  "chile": "CL", "china": "CN", "colombia": "CO", "costa rica": "CR", "croatia": "HR",
  "cuba": "CU", "cyprus": "CY", "czech republic": "CZ", "czechia": "CZ",
  "denmark": "DK", "dominican republic": "DO", "ecuador": "EC", "egypt": "EG",
  "el salvador": "SV", "estonia": "EE", "ethiopia": "ET", "fiji": "FJ", "finland": "FI",
  "france": "FR", "georgia": "GE", "germany": "DE", "ghana": "GH", "greece": "GR",
  "guatemala": "GT", "haiti": "HT", "honduras": "HN", "hong kong": "HK", "hungary": "HU",
  "iceland": "IS", "india": "IN", "indonesia": "ID", "iran": "IR", "iraq": "IQ",
  "ireland": "IE", "israel": "IL", "italy": "IT", "jamaica": "JM", "japan": "JP",
  "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE", "south korea": "KR", "korea": "KR",
  "kuwait": "KW", "kyrgyzstan": "KG", "laos": "LA", "latvia": "LV", "lebanon": "LB",
  "libya": "LY", "lithuania": "LT", "luxembourg": "LU", "macau": "MO", "macao": "MO",
  "madagascar": "MG", "malawi": "MW", "malaysia": "MY", "maldives": "MV", "mali": "ML",
  "malta": "MT", "mauritius": "MU", "mexico": "MX", "moldova": "MD", "monaco": "MC",
  "mongolia": "MN", "montenegro": "ME", "morocco": "MA", "mozambique": "MZ", "myanmar": "MM",
  "namibia": "NA", "nepal": "NP", "netherlands": "NL", "new zealand": "NZ", "nicaragua": "NI",
  "nigeria": "NG", "north macedonia": "MK", "norway": "NO", "oman": "OM", "pakistan": "PK",
  "panama": "PA", "paraguay": "PY", "peru": "PE", "philippines": "PH", "poland": "PL",
  "portugal": "PT", "qatar": "QA", "romania": "RO", "russia": "RU", "rwanda": "RW",
  "saudi arabia": "SA", "senegal": "SN", "serbia": "RS", "singapore": "SG", "slovakia": "SK",
  "slovenia": "SI", "south africa": "ZA", "spain": "ES", "sri lanka": "LK", "sudan": "SD",
  "sweden": "SE", "switzerland": "CH", "syria": "SY", "taiwan": "TW", "tajikistan": "TJ",
  "tanzania": "TZ", "thailand": "TH", "tunisia": "TN", "turkey": "TR", "türkiye": "TR",
  "turkmenistan": "TM", "uganda": "UG", "ukraine": "UA", "united arab emirates": "AE",
  "uae": "AE", "united kingdom": "GB", "uk": "GB", "united states": "US", "usa": "US",
  "uruguay": "UY", "uzbekistan": "UZ", "venezuela": "VE", "vietnam": "VN", "viet nam": "VN",
  "yemen": "YE", "zambia": "ZM", "zimbabwe": "ZW",
};

function toCountryCode(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Already a 2-letter code
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  // Try lookup
  return COUNTRY_CODE_MAP[trimmed.toLowerCase()] || null;
}

/** Infer emoji and mood from holiday label text */
function classifyHoliday(label: string): { emoji: string; mood: HolidayInfo["mood"] } {
  const l = label.toLowerCase();

  // ── Solemn / Memorial ──
  if (/martyr|memorial|remembrance|mourning|ashura|muharram|good friday|holocaust|genocide|anzac|armistice|veterans|fallen|funeral/.test(l))
    return { emoji: "🕯️", mood: "solemn" };

  // ── Islamic holidays ──
  if (/eid.?(ul|al).?fitr|eid.?(ul|al).?adha|eid.?milad|mawlid|shab.?e|ramadan|jumatul|lailat/.test(l))
    return { emoji: "🕌", mood: "religious" };

  // ── Hindu / Buddhist ──
  if (/diwali|deepavali|holi|navratri|dussehra|durga|ganesh|janmashtami|pongal|onam|vesak|buddha|purnima|makar|sankranti|mahanabami|chhath/.test(l))
    return { emoji: "🪔", mood: "religious" };

  // ── Christian ──
  if (/christmas|easter|good friday|whit|pentecost|ascension|epiphany|assumption|all saints|corpus christi/.test(l))
    return { emoji: "⛪", mood: "religious" };

  // ── Lunar New Year / Chinese / Korean / Vietnamese ──
  if (/lunar new year|chinese new year|spring festival|chuseok|tet|seollal|mid.?autumn|moon festival|lantern/.test(l))
    return { emoji: "🏮", mood: "festive" };

  // ── Jewish ──
  if (/rosh hashana|yom kippur|hanukkah|chanukah|passover|pesach|sukkot|purim|shavuot/.test(l))
    return { emoji: "✡️", mood: "religious" };

  // ── National / Independence / Republic ──
  if (/independence|republic|national day|liberation|revolution|constitution|victory|sovereignty|unification|freedom|uprising/.test(l))
    return { emoji: "🏛️", mood: "national" };

  // ── New Year ──
  if (/new year|año nuevo|nouvel an|neujahr|bengali new year|nowruz|nauryz|songkran/.test(l))
    return { emoji: "🎆", mood: "festive" };

  // ── Labour / Workers ──
  if (/labour|labor|may day|workers|worker/.test(l))
    return { emoji: "✊", mood: "national" };

  // ── Cultural / Language ──
  if (/language|cultural|heritage|thanksgiving|harvest|carnival|festival/.test(l))
    return { emoji: "🎭", mood: "cultural" };

  // ── Default festive ──
  return { emoji: "🎊", mood: "festive" };
}

/**
 * Fetches holidays overlapping with trip dates from high_demand_dates.
 * Returns a Map<dateString, HolidayInfo[]> for O(1) lookup per day.
 */
export function useTripHolidays(
  departDate: string | null | undefined,
  durationDays: number | undefined,
  destinationCountries: string[],
  /** Optional city→country mapping for multi-city trips */
  cityCountryMap?: Record<string, string>
) {
  const [holidayMap, setHolidayMap] = useState<Map<string, HolidayInfo[]>>(new Map());

  // Stabilise the countries array to avoid re-running the effect on every render
  const countriesKey = destinationCountries.join(",");

  useEffect(() => {
    if (!departDate || !durationDays || durationDays < 1) {
      setHolidayMap(new Map());
      return;
    }

    const start = new Date(departDate);
    if (isNaN(start.getTime())) return;

    const end = new Date(start);
    end.setDate(end.getDate() + durationDays);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    // Resolve country names to codes
    const codes = countriesKey
      .split(",")
      .filter(Boolean)
      .map(toCountryCode)
      .filter((c): c is string => c !== null);

    let cancelled = false;

    (async () => {
      try {
        let query = supabase
          .from("high_demand_dates")
          .select("date, label, country")
          .gte("date", startStr)
          .lte("date", endStr)
          .order("date");

        if (codes.length > 0) {
          query = query.in("country", codes);
        }

        const { data } = await query;
        if (cancelled || !data) return;

        const map = new Map<string, HolidayInfo[]>();
        for (const row of data) {
          const key = row.date;
          if (!map.has(key)) map.set(key, []);
          const lbl = row.label || "Holiday";
          const { emoji, mood } = classifyHoliday(lbl);
          map.get(key)!.push({ date: row.date, label: lbl, country: row.country || "", emoji, mood });
        }
        setHolidayMap(map);
      } catch {
        // non-fatal
      }
    })();

    return () => { cancelled = true; };
  }, [departDate, durationDays, countriesKey]);

  /**
   * Get holidays for a specific day number (1-indexed).
   * When dayCountry is provided, only returns holidays for that country.
   */
  const getHolidaysForDay = useCallback((dayNumber: number, dayCity?: string): HolidayInfo[] => {
    if (!departDate) return [];
    const d = new Date(departDate);
    d.setDate(d.getDate() + dayNumber - 1);
    const dateStr = d.toISOString().split("T")[0];
    const all = holidayMap.get(dateStr) || [];
    if (!dayCity || all.length === 0) return all;

    const mappedCountry = cityCountryMap?.[dayCity] || cityCountryMap?.[dayCity.toLowerCase()];
    const dayCode = toCountryCode(mappedCountry || dayCity);
    if (!dayCode) return all;

    return all.filter(h => {
      const hCode = toCountryCode(h.country);
      return hCode === dayCode;
    });
  }, [departDate, holidayMap, cityCountryMap]);

  return { holidayMap, getHolidaysForDay };
}
