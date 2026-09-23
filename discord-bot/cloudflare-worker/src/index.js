const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function supabaseHeaders(env) {
  const key = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function supabaseRequest(env, path, init = {}) {
  const baseUrl = requireEnv(env, "SUPABASE_URL").replace(/\/$/, "");
  const headers = {
    ...supabaseHeaders(env),
    ...(init.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }

  return response;
}

async function getSingle(env, table, filter) {
  const response = await supabaseRequest(
    env,
    `/rest/v1/${table}?${filter}&select=*`,
    { headers: { Accept: "application/vnd.pgrst.object+json" } },
  );
  return response.json();
}

async function markEventSent(env, eventId, messageId) {
  await supabaseRequest(
    env,
    `/rest/v1/discord_first_blood_events?id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        sent_at: new Date().toISOString(),
        discord_message_id: messageId || null,
      }),
    },
  );
}

async function sendDiscordMessage(env, content) {
  const webhookUrl = requireEnv(env, "DISCORD_WEBHOOK_URL");
  const roleId = env.MENTION_ROLE_ID && env.MENTION_ROLE_ID !== "0"
    ? env.MENTION_ROLE_ID
    : null;

  const response = await fetch(`${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}wait=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content,
      allowed_mentions: roleId ? { roles: [roleId] } : { parse: [] },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${details}`);
  }

  return response.json();
}

async function handleEvent(payload, env) {
  const event = payload?.record;
  if (
    payload?.type !== "INSERT" ||
    payload?.table !== "discord_first_blood_events" ||
    !event?.id
  ) {
    return { ignored: true };
  }

  const currentEvent = await getSingle(
    env,
    "discord_first_blood_events",
    `id=eq.${encodeURIComponent(event.id)}`,
  );

  // Supabase Database Webhooks can retry delivery. Do not post twice after
  // the event has already been delivered successfully.
  if (currentEvent.sent_at) {
    return { duplicate: true };
  }

  const [challenge, user] = await Promise.all([
    getSingle(
      env,
      "challenges",
      `id=eq.${encodeURIComponent(currentEvent.challenge_id)}`,
    ),
    getSingle(
      env,
      "users",
      `id=eq.${encodeURIComponent(currentEvent.user_id)}`,
    ),
  ]);

  const roleMention = env.MENTION_ROLE_ID && env.MENTION_ROLE_ID !== "0"
    ? ` <@&${env.MENTION_ROLE_ID}>`
    : "";
  const content =
    `🩸 **${user.username || "<unknown>"}** claimed first blood on ` +
    `**${challenge.title || "<unknown>"}** (${challenge.category || "<unknown>"})` +
    `${roleMention}`;

  const message = await sendDiscordMessage(env, content);
  await markEventSent(env, currentEvent.id, message?.id);

  return { delivered: true, eventId: currentEvent.id };
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const expectedSecret = requireEnv(env, "SUPABASE_WEBHOOK_SECRET");
    const receivedSecret = request.headers.get("x-webhook-secret");
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    try {
      const payload = await request.json();
      const result = await handleEvent(payload, env);
      return json(result);
    } catch (error) {
      console.error(error);
      return json({ error: "Notification delivery failed" }, 500);
    }
  },
};
