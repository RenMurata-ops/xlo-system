import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page, context }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  // Authenticate via API
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@xlo-system.com',
    password: 'TestPassword123!',
  });

  if (error || !data.session) {
    throw new Error(`Auth setup failed: ${error?.message || 'No session'}`);
  }

  // Navigate to app
  await page.goto('/');

  // Inject the session into browser storage
  await page.evaluate((session) => {
    // Set localStorage (for client-side Supabase client)
    localStorage.setItem('xlo-auth', JSON.stringify(session));

    // Also set in a format that might work with SSR
    localStorage.setItem(`sb-${location.host}-auth-token`, JSON.stringify(session));
  }, data.session);

  // Save signed-in state
  await page.context().storageState({ path: authFile });

  console.log('✓ Authentication setup complete');
});
