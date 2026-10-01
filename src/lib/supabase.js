// Thin Supabase client for the battery test's results storage. Reads its
// project URL/key from Vite env vars (see .env.example) so no secret is
// ever hard-coded here — the anon key is meant to be public, its access
// is limited entirely by the Row Level Security policies in
// supabase/schema.sql.
//
// Both vars are optional at build time: if they're unset (e.g. a fresh
// checkout before Bryony has created a Supabase project yet), `supabase`
// is null and TestApp.svelte falls back to the old in-memory-only
// behaviour instead of throwing.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
