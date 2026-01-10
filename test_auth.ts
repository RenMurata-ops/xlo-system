#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function testAuth() {
  console.log('Creating Supabase client...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Attempting to sign in...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@xlo-system.com',
    password: 'TestPassword123!'
  });

  if (error) {
    console.error('Authentication failed:', error);
    return;
  }

  console.log('✅ Authentication successful!');
  console.log('User ID:', data.user.id);
  console.log('Email:', data.user.email);
}

testAuth();
