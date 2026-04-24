import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { postId, title, excerpt, tags } = await req.json();
    if (!postId || !title) {
      return new Response(JSON.stringify({ error: "postId and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if post already has an image (race condition guard)
    const { data: post } = await supabase
      .from("blog_posts")
      .select("featured_image")
      .eq("id", postId)
      .maybeSingle();

    if (post?.featured_image) {
      return new Response(JSON.stringify({ url: post.featured_image }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a descriptive prompt from the blog post metadata
    const tagStr = (tags || []).slice(0, 5).join(", ");
    const prompt = `Create a stunning, editorial-quality travel photograph for a blog article titled "${title}". ${excerpt ? `The article is about: ${excerpt.slice(0, 150)}` : ""} ${tagStr ? `Related topics: ${tagStr}.` : ""} The image should be vibrant, professional, cinematic lighting, no text or watermarks. Landscape orientation.`;

    console.log("Generating image for post:", postId, "prompt:", prompt.slice(0, 100));

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl) {
      console.error("No image returned from AI");
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract base64 and upload to Supabase storage
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const fileName = `blog-images/${postId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload image");
    }

    const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(fileName);
    const url = publicUrl.publicUrl;

    // Update the blog post with the generated image
    await supabase
      .from("blog_posts")
      .update({ featured_image: url })
      .eq("id", postId);

    console.log("Image generated and saved for post:", postId);

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-blog-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
