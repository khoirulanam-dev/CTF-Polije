# Cloudflare Discord notifier

This Worker is event-driven. It does not poll Supabase. Supabase sends an HTTP
request only when the database trigger creates a first-blood event.

## Cloudflare secrets

Configure these with `wrangler secret put` or in the Cloudflare dashboard:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_WEBHOOK_URL`
- `SUPABASE_WEBHOOK_SECRET`
- `MENTION_ROLE_ID` (optional; use `0` to disable mentions)

## Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put SUPABASE_WEBHOOK_SECRET
npx wrangler secret put MENTION_ROLE_ID
npx wrangler deploy
```

## Supabase Database Webhook

After deploying the Worker, create a Supabase Database Webhook:

- Table: `discord_first_blood_events`
- Event: `INSERT`
- URL: the deployed Worker URL
- Header: `x-webhook-secret: <same value as SUPABASE_WEBHOOK_SECRET>`

Run the migration before creating the webhook. The webhook should be attached
to the event table, not to `solves`, so ordinary solves that are not first blood
do not invoke the Worker.
