// Passport OCR — extracts MRZ + visual fields. Uses admin-controlled router (task: "passport-ocr").
import { runAITask } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ success: false, error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a passport OCR system. Analyze this passport image and extract the following fields.
Return ONLY valid JSON with these exact keys:
{
  "surname": "Family name / surname as written on passport",
  "given_name": "Given names as written on passport",
  "dob": "Date of birth in YYYY-MM-DD format",
  "gender": "M or F",
  "nationality": "Nationality as written (e.g. BANGLADESHI, INDIAN)",
  "passport_number": "Passport number",
  "expiry_date": "Expiry date in YYYY-MM-DD format",
  "issuing_country": "Country code or name that issued the passport"
}

Rules:
- Convert all dates to YYYY-MM-DD format
- Use uppercase for nationality
- If a field is not readable, set it to null
- Do NOT guess or fabricate any data — only extract what is clearly visible
- For MRZ (Machine Readable Zone) at the bottom, use it to validate/supplement the visual fields`;

    const result = await runAITask({
      taskKey: "passport-ocr",
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
      inlineImage: { mimeType: "image/jpeg", data: image },
    });

    if (!result.content) {
      return new Response(JSON.stringify({ success: false, error: "No data extracted" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(result.content);

    return new Response(
      JSON.stringify({ success: true, extracted, _model: `${result.provider}/${result.model}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("passport-ocr error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
