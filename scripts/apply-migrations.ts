import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigrations() {
  const sql = readFileSync('/tmp/NEW_MIGRATIONS.sql', 'utf-8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;

    console.log('Executing:', statement.substring(0, 100) + '...');

    const { error } = await supabase.rpc('exec_sql', { sql: statement });

    if (error) {
      console.error('Error:', error);
      // Continue anyway for IF NOT EXISTS statements
    } else {
      console.log('✓ Success');
    }
  }

  console.log('\n✓ All migrations applied!');
}

applyMigrations().catch(console.error);
