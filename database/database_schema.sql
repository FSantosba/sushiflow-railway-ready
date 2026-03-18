-- 1. Tabela de Usuários Unificada (Segurança e Perfis)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('cliente', 'motoboy', 'admin', 'cozinha')),
    status_disponibilidade BOOLEAN DEFAULT true, -- Para motoboys: "estou online?"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cardápio Sincronizado (Preço de Balcão)
CREATE TABLE produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    estoque_ativo BOOLEAN DEFAULT true,
    categoria TEXT,
    imagem_url TEXT
);

-- 3. O Coração: Pedidos e Status Profissional
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES usuarios(id),
    motoboy_id UUID REFERENCES usuarios(id),
    valor_itens DECIMAL(10,2) NOT NULL,
    taxa_entrega DECIMAL(10,2) NOT NULL,
    total_geral DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'pago', 'em_preparo', 'pronto_coleta', 'em_rota', 'entregue', 'cancelado'
    )),
    endereco_entrega JSONB NOT NULL, -- Rua, Num, Lat/Long
    metodo_pagamento TEXT,
    tempo_estimado_minutos INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Logística Real-Time (Rastreamento)
CREATE TABLE rastreamento_entrega (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES pedidos(id),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Carteira Digital (Transparência com o Motoboy)
CREATE TABLE transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id),
    pedido_id UUID REFERENCES pedidos(id),
    valor DECIMAL(10,2) NOT NULL,
    tipo TEXT CHECK (tipo IN ('credito_entrega', 'debito_taxa', 'venda_restaurante')),
    data_transacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
