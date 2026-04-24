// Sabre Booking — Create PNR via Sabre REST API
// Creates a Passenger Name Record with flight segments, passenger details, and contact info

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SabreCredentials {
  client_id: string;
  client_secret: string;
  pcc: string;
  environment?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getSabreBaseUrl(env?: string): string {
  return env === "production"
    ? "https://api.havail.sabre.com"
    : "https://api-crt.cert.havail.sabre.com";
}

async function getCredentials(tenantCredentials?: SabreCredentials): Promise<SabreCredentials> {
  if (tenantCredentials?.client_id && tenantCredentials?.client_secret) return tenantCredentials;
  const client_id = Deno.env.get("SABRE_CLIENT_ID");
  const client_secret = Deno.env.get("SABRE_CLIENT_SECRET");
  const pcc = Deno.env.get("SABRE_PCC") || "";
  const environment = Deno.env.get("SABRE_ENVIRONMENT") || "test";
  if (!client_id || !client_secret) throw new Error("Sabre credentials not configured");
  return { client_id, client_secret, pcc, environment };
}

async function getAuthToken(creds: SabreCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;
  const baseUrl = getSabreBaseUrl(creds.environment);
  const encoded = btoa(`${creds.client_id}:${creds.client_secret}`);
  const response = await fetch(`${baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Sabre auth failed: ${response.status}`);
  const data = await response.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 604800) * 1000 };
  return cachedToken.token;
}

function formatDate(dateStr: string): string {
  // Convert "1990-05-15" → "1990-05-15"
  return dateStr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { flight, passengers, contact } = body;

    if (!flight || !passengers || !contact) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields: flight, passengers, contact",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await getCredentials(body.tenantCredentials);
    const token = await getAuthToken(creds);
    const baseUrl = getSabreBaseUrl(creds.environment);

    const segments = flight.segments || [];
    if (segments.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No segments in flight" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build CreatePassengerNameRecordRQ
    const airBook = segments.map((seg: any, idx: number) => ({
      DepartureDateTime: seg.departure?.replace("T", " ").substring(0, 19),
      ArrivalDateTime: seg.arrival?.replace("T", " ").substring(0, 19),
      FlightNumber: seg.flightNumber?.replace(/^[A-Z]{2}/, "") || "",
      NumberInParty: String(passengers.length),
      ResBookDesigCode: seg.bookingCode || "Y",
      Status: "NN",
      InstantPurchase: false,
      OriginLocation: { LocationCode: seg.from },
      DestinationLocation: { LocationCode: seg.to },
      MarketingAirline: {
        Code: seg.carrier,
        FlightNumber: seg.flightNumber?.replace(/^[A-Z]{2}/, "") || "",
      },
    }));

    // Build passenger info
    const personNames = passengers.map((pax: any, idx: number) => {
      const nameNumber = `${idx + 1}.1`;
      const result: any = {
        NameNumber: nameNumber,
        GivenName: pax.firstName || pax.first_name,
        Surname: pax.lastName || pax.last_name,
        NameReference: `ABC${idx + 1}`,
      };
      
      // Passenger type
      const paxType = (pax.type || pax.paxType || "ADT").toUpperCase();
      if (paxType === "INF" || paxType === "INFANT") {
        result.Infant = true;
        result.NameReference = `I/${idx + 1}`;
      }

      return result;
    });

    // Contact info
    const contactInfo: any = {
      ContactNumbers: {
        ContactNumber: [{
          Phone: contact.phone || "0000000000",
          PhoneUseType: "H",
        }],
      },
      PersonName: personNames[0] ? {
        GivenName: personNames[0].GivenName,
        Surname: personNames[0].Surname,
      } : undefined,
    };

    // Build Advanced Passenger Information (APIS) for international
    const advancePassenger = passengers.map((pax: any, idx: number) => ({
      Document: {
        Number: pax.passportNumber || pax.passport_number || "",
        Type: "P",
        ExpirationDate: pax.passportExpiry || pax.passport_expiry || "",
        IssueCountry: pax.passportCountry || pax.passport_country || pax.nationality || "",
      },
      PersonName: {
        GivenName: pax.firstName || pax.first_name,
        MiddleName: pax.middleName || "",
        Surname: pax.lastName || pax.last_name,
        DateOfBirth: pax.dob || pax.dateOfBirth || "",
        Gender: (pax.gender || pax.title === "Mr" || pax.title === "MR") ? "M" : "F",
        NameNumber: `${idx + 1}.1`,
      },
      SegmentNumber: "A",
    }));

    const createPNRRequest = {
      CreatePassengerNameRecordRQ: {
        version: "2.4.0",
        TravelItineraryAddInfo: {
          AgencyInfo: {
            Ticketing: { TicketType: "7TAW" },
          },
          CustomerInfo: {
            ContactNumbers: {
              ContactNumber: [{
                Phone: contact.phone || "0000000000",
                PhoneUseType: "H",
              }],
            },
            Email: [{
              Address: contact.email,
              Type: "TO",
            }],
            PersonName: personNames,
          },
        },
        AirBook: {
          HaltOnStatus: [{ Code: "NN" }, { Code: "UC" }, { Code: "US" }, { Code: "NO" }],
          OriginDestinationInformation: {
            FlightSegment: airBook,
          },
          RedisplayReservation: { NumAttempts: 3, WaitInterval: 2000 },
        },
        AirPrice: [{
          PriceRequestInformation: {
            Retain: true,
            OptionalQualifiers: {
              PricingQualifiers: {
                PassengerType: [
                  { Code: "ADT", Quantity: String(passengers.filter((p: any) => !["INF", "CNN", "CHD"].includes((p.type || "ADT").toUpperCase())).length || 1) },
                ],
              },
            },
          },
        }],
        SpecialReqDetails: {
          SpecialService: {
            SpecialServiceInfo: {
              AdvancePassenger: advancePassenger,
            },
          },
        },
        PostProcessing: {
          EndTransaction: {
            Source: { ReceivedFrom: "VELA TRAVEL API" },
          },
        },
      },
    };

    console.log(`[sabre-book] Creating PNR: ${passengers.length} pax, ${segments.length} segments`);

    const response = await fetch(`${baseUrl}/v2.4.0/passenger/records?mode=create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPNRRequest),
    });

    const responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("[sabre-book] Non-JSON response:", responseText);
      return new Response(JSON.stringify({
        success: false,
        error: `Sabre returned non-JSON response: ${response.status}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      console.error(`[sabre-book] PNR creation failed: ${response.status}`, result);
      const errorMsg = result?.CreatePassengerNameRecordRS?.ApplicationResults?.Error?.[0]?.SystemSpecificResults?.[0]?.Message || 
                       "PNR creation failed";
      return new Response(JSON.stringify({
        success: false,
        error: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
        details: result,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract PNR locator
    const pnrLocator = result?.CreatePassengerNameRecordRS?.ItineraryRef?.ID || "";
    const appResults = result?.CreatePassengerNameRecordRS?.ApplicationResults;
    const isSuccess = appResults?.status === "Complete";

    console.log(`[sabre-book] PNR created: ${pnrLocator}, success=${isSuccess}`);

    return new Response(JSON.stringify({
      success: isSuccess || !!pnrLocator,
      pnr: pnrLocator,
      confirmationNumber: pnrLocator,
      provider: "sabre",
      details: {
        status: appResults?.status,
        pnr: pnrLocator,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[sabre-book] error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
