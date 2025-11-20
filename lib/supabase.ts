import { createClient } from './supabase/client'

// Re-export createClient
export { createClient }

// For backward compatibility - note: this creates instance at module load time
// Components should prefer using createClient() for proper singleton behavior
export const supabase = createClient()
