import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find expired messages with images
    const { data: expiredMessages, error: fetchError } = await supabase
      .from("chat_messages")
      .select("id, image_url")
      .not("image_url", "is", null)
      .lt("expires_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredMessages || expiredMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired images found", cleaned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Null out image_url for expired messages
    const ids = expiredMessages.map((m) => m.id);
    const { error: updateError } = await supabase
      .from("chat_messages")
      .update({ image_url: null })
      .in("id", ids);

    if (updateError) throw updateError;

    console.log(`Cleaned ${ids.length} expired image(s)`);

    return new Response(
      JSON.stringify({ message: "Cleanup complete", cleaned: ids.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
