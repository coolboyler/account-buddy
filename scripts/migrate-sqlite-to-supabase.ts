import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfigFromEnv } from '../server/supabase-store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sqlitePath = process.env.DB_PATH ?? path.join(projectRoot, 'data', 'accountbuddy.sqlite');
const config = getSupabaseConfigFromEnv();

if (!config) {
  throw new Error('请先设置 SUPABASE_PROJECT_ID/SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY');
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function upsertTable<T extends Record<string, unknown>>(tableName: string, rows: T[]) {
  if (rows.length === 0) {
    console.log(`${tableName}: 0 rows`);
    return;
  }

  const { error } = await supabase.from(tableName).upsert(rows as never[], { onConflict: 'id' });
  if (error) {
    throw new Error(`${tableName} 导入失败: ${error.message}`);
  }

  console.log(`${tableName}: ${rows.length} rows`);
}

const users = sqlite.prepare('SELECT id, name FROM users ORDER BY id ASC').all() as Array<Record<string, unknown>>;
const authUsers = sqlite.prepare('SELECT id, username, password_hash FROM auth_users ORDER BY id ASC').all() as Array<Record<string, unknown>>;
const expenses = sqlite.prepare(`
  SELECT id, description, amount, paid_by, date, category, settled_at
  FROM expenses
  ORDER BY rowid ASC
`).all() as Array<Record<string, unknown>>;

await upsertTable('users', users);
await upsertTable('auth_users', authUsers);
await upsertTable('expenses', expenses);

sqlite.close();
console.log(`Imported ${users.length + authUsers.length + expenses.length} rows from ${sqlitePath} to ${config.url}`);
