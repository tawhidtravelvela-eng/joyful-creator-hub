/**
 * Crisp Workflow Action-Webhook Handler
 * 
 * Receives webhook payloads from Crisp Workflows and performs conversation
 * operations via the Crisp REST API v1.
 * 
 * Supported actions:
 * - send_message: Send text/note/picker/carousel messages
 * - change_state: Resolve, unresolve, or set pending
 * - update_metas: Update nickname, email, phone, data, segments
 * - assign_routing: Assign/unassign conversation to operator
 * - add_note: Add an internal note to the conversation
 * - get_conversation: Retrieve conversation details
 * - get_messages: Retrieve conversation messages
 * 
 * Authentication: Bearer token (CRISP_WEBHOOK_SECRET) for incoming webhooks
 * Crisp API: Plugin token auth (CRISP_PLUGIN_IDENTIFIER + CRISP_PLUGIN_KEY)
 */

const CRISP_API_BASE = "https://api.crisp.chat/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crisp API helper ──
async function crispApi(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const identifier = Deno.env.get("CRISP_PLUGIN_IDENTIFIER");
  const key = Deno.env.get("CRISP_PLUGIN_KEY");

  if (!identifier || !key) {
    throw new Error("CRISP_PLUGIN_IDENTIFIER and CRISP_PLUGIN_KEY must be set");
  }

  const auth = btoa(`${identifier}:${key}`);
  const url = `${CRISP_API_BASE}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    "X-Crisp-Tier": "plugin",
  };

  const opts: RequestInit = { method, headers };
  if (body && method !== "GET" && method !== "HEAD") {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── Verify incoming webhook secret ──
function verifyWebhookAuth(req: Request): boolean {
  const secret = Deno.env.get("CRISP_WEBHOOK_SECRET");
  if (!secret) return true; // No secret = open (for testing)

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === secret;
}

// ── Action handlers ──

async function handleSendMessage(websiteId: string, sessionId: string, params: any) {
  const {
    type = "text",
    content,
    from = "operator",
    origin = "chat",
    user,
    stealth,
    automated,
  } = params;

  const body: any = { type, from, origin, content };
  if (user) body.user = user;
  if (stealth !== undefined) body.stealth = stealth;
  if (automated !== undefined) body.automated = automated;

  return crispApi(
    "POST",
    `/website/${websiteId}/conversation/${sessionId}/message`,
    body
  );
}

async function handleChangeState(websiteId: string, sessionId: string, params: any) {
  const { state } = params; // "pending" | "unresolved" | "resolved"
  if (!["pending", "unresolved", "resolved"].includes(state)) {
    throw new Error("state must be 'pending', 'unresolved', or 'resolved'");
  }

  return crispApi(
    "PATCH",
    `/website/${websiteId}/conversation/${sessionId}/state`,
    { state }
  );
}

async function handleUpdateMetas(websiteId: string, sessionId: string, params: any) {
  const { nickname, email, phone, address, subject, data, segments, avatar } = params;
  const body: any = {};

  if (nickname !== undefined) body.nickname = nickname;
  if (email !== undefined) body.email = email;
  if (phone !== undefined) body.phone = phone;
  if (address !== undefined) body.address = address;
  if (subject !== undefined) body.subject = subject;
  if (data !== undefined) body.data = data;
  if (segments !== undefined) body.segments = segments;
  if (avatar !== undefined) body.avatar = avatar;

  return crispApi(
    "PATCH",
    `/website/${websiteId}/conversation/${sessionId}/meta`,
    body
  );
}

async function handleAssignRouting(websiteId: string, sessionId: string, params: any) {
  const { user_id, silent } = params;
  const body: any = {
    assigned: user_id ? { user_id } : {},
  };
  if (silent !== undefined) body.silent = silent;

  return crispApi(
    "PATCH",
    `/website/${websiteId}/conversation/${sessionId}/routing`,
    body
  );
}

async function handleAddNote(websiteId: string, sessionId: string, params: any) {
  const { content, user } = params;
  const body: any = {
    type: "note",
    from: "operator",
    origin: "chat",
    content,
  };
  if (user) body.user = user;

  return crispApi(
    "POST",
    `/website/${websiteId}/conversation/${sessionId}/message`,
    body
  );
}

async function handleGetConversation(websiteId: string, sessionId: string) {
  return crispApi("GET", `/website/${websiteId}/conversation/${sessionId}`);
}

async function handleGetMessages(websiteId: string, sessionId: string, params: any) {
  const { timestamp_before } = params || {};
  let path = `/website/${websiteId}/conversation/${sessionId}/messages`;
  if (timestamp_before) {
    path += `?timestamp_before=${timestamp_before}`;
  }
  return crispApi("GET", path);
}

async function handleMarkRead(websiteId: string, sessionId: string, params: any) {
  const { from = "operator", origin = "chat", fingerprints } = params || {};
  const body: any = { from, origin };
  if (fingerprints) body.fingerprints = fingerprints;

  return crispApi(
    "PATCH",
    `/website/${websiteId}/conversation/${sessionId}/read`,
    body
  );
}

async function handleUpdateInbox(websiteId: string, sessionId: string, params: any) {
  const { inbox_id } = params;
  return crispApi(
    "PATCH",
    `/website/${websiteId}/conversation/${sessionId}/inbox`,
    { inbox_id: inbox_id || null }
  );
}

async function handleBlockConversation(websiteId: string, sessionId: string, params: any) {
  const { blocked = true } = params;
  return crispApi(
    "PATCH",
    `/website/${websiteId}/conversation/${sessionId}/block`,
    { blocked }
  );
}

async function handleCreateConversation(websiteId: string) {
  return crispApi("POST", `/website/${websiteId}/conversation`, {});
}

async function handleSearchConversations(websiteId: string, params: any) {
  const { search_query, page = 1 } = params;
  let path = `/website/${websiteId}/conversations/${page}`;
  if (search_query) {
    path += `?search_query=${encodeURIComponent(search_query)}`;
  }
  return crispApi("GET", path);
}

async function handleGetConversationMeta(websiteId: string, sessionId: string) {
  return crispApi("GET", `/website/${websiteId}/conversation/${sessionId}/meta`);
}

async function handleRemoveConversation(websiteId: string, sessionId: string) {
  return crispApi("DELETE", `/website/${websiteId}/conversation/${sessionId}`);
}

async function handleSaveParticipants(websiteId: string, sessionId: string, params: any) {
  const { participants } = params;
  return crispApi(
    "PUT",
    `/website/${websiteId}/conversation/${sessionId}/participants`,
    { participants }
  );
}

// ── Main handler ──
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Auth check
  if (!verifyWebhookAuth(req)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const payload = await req.json();

    /**
     * Expected payload format:
     * {
     *   "action": "send_message" | "change_state" | "update_metas" | "assign_routing" | ...
     *   "website_id": "xxx",
     *   "session_id": "session_xxx",
     *   "params": { ... action-specific params }
     * }
     * 
     * Crisp Workflow webhook payloads may also include:
     * - event, data.website_id, data.session_id at the top level
     * We normalize both formats.
     */
    const action = payload.action || payload.event;
    const websiteId = payload.website_id || payload.data?.website_id;
    const sessionId = payload.session_id || payload.data?.session_id;
    const params = payload.params || payload.data || {};

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing 'action' field", supported_actions: [
          "send_message", "change_state", "update_metas", "assign_routing",
          "add_note", "get_conversation", "get_messages", "mark_read",
          "update_inbox", "block", "create_conversation", "remove_conversation",
          "save_participants"
        ]}),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Actions that only need website_id
    if (action === "create_conversation" || action === "search_conversations") {
      if (!websiteId) {
        return new Response(
          JSON.stringify({ error: "Missing 'website_id'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = action === "create_conversation"
        ? await handleCreateConversation(websiteId)
        : await handleSearchConversations(websiteId, params);
      return new Response(
        JSON.stringify({ success: result.status < 400, ...result.data }),
        { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other actions need both website_id and session_id
    if (!websiteId || !sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing 'website_id' or 'session_id'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { status: number; data: any };

    switch (action) {
      case "send_message":
        result = await handleSendMessage(websiteId, sessionId, params);
        break;
      case "change_state":
        result = await handleChangeState(websiteId, sessionId, params);
        break;
      case "update_metas":
        result = await handleUpdateMetas(websiteId, sessionId, params);
        break;
      case "assign_routing":
        result = await handleAssignRouting(websiteId, sessionId, params);
        break;
      case "add_note":
        result = await handleAddNote(websiteId, sessionId, params);
        break;
      case "get_conversation":
        result = await handleGetConversation(websiteId, sessionId);
        break;
      case "get_messages":
        result = await handleGetMessages(websiteId, sessionId, params);
        break;
      case "mark_read":
        result = await handleMarkRead(websiteId, sessionId, params);
        break;
      case "update_inbox":
        result = await handleUpdateInbox(websiteId, sessionId, params);
        break;
      case "block":
        result = await handleBlockConversation(websiteId, sessionId, params);
        break;
      case "remove_conversation":
        result = await handleRemoveConversation(websiteId, sessionId);
        break;
      case "save_participants":
        result = await handleSaveParticipants(websiteId, sessionId, params);
        break;
      case "search_conversations":
        result = await handleSearchConversations(websiteId, params);
        break;
      case "get_conversation_meta":
        result = await handleGetConversationMeta(websiteId, sessionId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[crisp-webhook] ${action} → ${result.status}`, JSON.stringify(result.data).slice(0, 200));

    return new Response(
      JSON.stringify({ success: result.status < 400, action, ...result.data }),
      { status: result.status >= 400 ? result.status : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[crisp-webhook] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
