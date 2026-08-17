import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectTable() {
  const { data, error } = await supabase.rpc('get_table_schema', { t_name: 'purchase_orders' });
  if (error) {
    // If get_table_schema RPC doesn't exist, use execute_sql tool or run a query on information_schema.
    console.log('RPC get_table_schema failed, querying information_schema via regular select is not directly possible on supabase without execute_sql or custom RPC.');
    
    // Let's try executing SQL if possible, or just query information_schema columns.
    // Wait, anonymouse web client has no access to information_schema unless exposed or through an execute_sql tool.
    // Wait! Do we have the supabase execute_sql tool?
    // Let's check our mcp_servers. Eagerly loaded tools: we don't see execute_sql as eager.
    // In <mcp_servers>, we have:
    // ServerName: supabase
    // Lazy: list_tables, execute_sql, etc.
    // Yes! We have the lazy execute_sql tool! We can call it using default_api:call_mcp_tool!
  } else {
    console.log(data);
  }
}

inspectTable().catch(console.error);
