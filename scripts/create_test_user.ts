#!/usr/bin/env node

/**
 * Create test user properly using Supabase Auth API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const testEmail = 'test@xlo-system.com';
const testPassword = 'TestPassword123!';

async function createTestUser() {
  console.log('Creating Supabase client...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Check if user already exists
    console.log(`Checking if user ${testEmail} exists...`);
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const existingUser = existingUsers.users.find(u => u.email === testEmail);

    if (existingUser) {
      console.log(`User ${testEmail} already exists with ID: ${existingUser.id}`);
      console.log('Deleting existing user...');

      const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        throw deleteError;
      }
      console.log('Existing user deleted.');
    }

    // Create new user
    console.log(`Creating user ${testEmail}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User'
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      throw error;
    }

    console.log('✅ Test user created successfully!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No');
    console.log('\nCredentials:');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);

    return data.user;
  } catch (error) {
    console.error('Failed to create test user:', error);
    process.exit(1);
  }
}

createTestUser();
