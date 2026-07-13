import { config } from '../config.js';
import { FileStore } from './fileStore.js';
import { SupabaseStore } from './supabaseStore.js';
import type { AppStore } from './types';

export function createStore(): AppStore {
  if (config.useSupabase) {
    if (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceRoleKey) {
      throw new Error('USE_SUPABASE=true requiere SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.');
    }
    return new SupabaseStore(config.supabaseUrl, config.supabaseAnonKey, config.supabaseServiceRoleKey);
  }
  return new FileStore();
}
