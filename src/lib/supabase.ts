import { createClient } from "@supabase/supabase-js";

// Client padrão para o frontend/ações autenticadas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Client com bypass (Service / Admin) para uso exclusivo em rotas de API
export const supabaseAdmin = createClient(
    supabaseUrl, 
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey, 
    { auth: { persistSession: false } }
);
