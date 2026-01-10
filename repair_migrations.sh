#!/bin/bash

export SUPABASE_ACCESS_TOKEN="sbp_abce6574074ffd02eacd722c71836d1954b75978"

# Repair old migrations
npx supabase migration repair --status applied 20251110
npx supabase migration repair --status applied 20251112
npx supabase migration repair --status applied 20251113
npx supabase migration repair --status applied 20251114
npx supabase migration repair --status applied 20251116
npx supabase migration repair --status applied 20251117002
npx supabase migration repair --status applied 20251117003
npx supabase migration repair --status applied 20251117
npx supabase migration repair --status applied 20251118002
npx supabase migration repair --status applied 20251118
npx supabase migration repair --status applied 20251119000001
npx supabase migration repair --status applied 20251119000002
npx supabase migration repair --status applied 20251119000003
npx supabase migration repair --status applied 20251119000004
npx supabase migration repair --status applied 20251119000005
npx supabase migration repair --status applied 20251119000006
npx supabase migration repair --status applied 20251119000007
npx supabase migration repair --status applied 20251119000008
npx supabase migration repair --status applied 20251119000009
npx supabase migration repair --status applied 20251119000010
npx supabase migration repair --status applied 20251119000011
npx supabase migration repair --status applied 20251119000013
npx supabase migration repair --status applied 20251119000014
npx supabase migration repair --status applied 20251120000001
npx supabase migration repair --status applied 20251120000002

echo "Base migrations repaired. Now checking if new migrations need to be applied..."
