import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfigFromEnv } from '../server/supabase-store.ts';

const config = getSupabaseConfigFromEnv();
if (!config) {
  throw new Error('请先设置 SUPABASE_PROJECT_ID/SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('创建 Supabase Auth 用户需要 SUPABASE_SERVICE_ROLE_KEY');
}

const email = process.env.AUTH_EMAIL ?? 'house@account-buddy.local';
const password = process.env.AUTH_PASSWORD ?? '260321';
const supabase = createClient(config.url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  throw listError;
}

const existingUser = existingUsers.users.find((user: { id: string; email?: string }) => user.email?.toLowerCase() === email.toLowerCase());
if (existingUser) {
  const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    throw error;
  }
  console.log(`Updated Supabase Auth user: ${email}`);
} else {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    throw error;
  }
  console.log(`Created Supabase Auth user: ${email}`);
}
