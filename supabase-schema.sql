-- Criação da tabela de módulos
CREATE TABLE IF NOT EXISTS public.modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT
);

-- Habilitar RLS (Row Level Security) para modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Permitir qualquer um ler os módulos (select)
CREATE POLICY "Enable read access for all users" ON public.modules FOR SELECT USING (true);

-- Permitir usuários autenticados (professores) inserirem e alterarem módulos
CREATE POLICY "Enable insert for authenticated users only" ON public.modules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public.modules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON public.modules FOR DELETE TO authenticated USING (true);


-- Criação da tabela de questões vinculada aos módulos
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
    prompt TEXT NOT NULL,
    options JSONB NOT NULL, -- Arrays de texto ['Opção A', 'Opção B']
    correct_option_index INTEGER NOT NULL,
    explanation_base TEXT NOT NULL
);

-- Habilitar RLS para questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Permitir qualquer um ler as questões (select)
CREATE POLICY "Enable read access for all users" ON public.questions FOR SELECT USING (true);

-- Permitir usuários autenticados (professores) inserirem e alterarem questões
CREATE POLICY "Enable insert for authenticated users only" ON public.questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public.questions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON public.questions FOR DELETE TO authenticated USING (true);
