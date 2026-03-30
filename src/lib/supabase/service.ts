import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Cliente Supabase com service role key — bypassa RLS.
 * USO EXCLUSIVO em API routes server-side. NUNCA em 'use client'.
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
