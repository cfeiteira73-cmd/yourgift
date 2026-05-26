import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 *
 * IMPORTANT: Do NOT set a custom `storageKey` here.
 * The server-side clients in /auth/callback and middleware use the default
 * storage key (`sb-<project-ref>-auth-token`). A custom key on the browser
 * client causes a PKCE code-verifier mismatch → exchangeCodeForSession fails.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Implicit-flow client for magic links.
 *
 * Magic links are often opened in a different browser/email client, so PKCE
 * (which requires the code verifier to be in the same browser session) cannot
 * be used. Implicit flow sends a `token_hash` in the email link that works
 * cross-browser and is handled by /auth/confirm.
 */
export function createImplicitClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } },
  );
}
