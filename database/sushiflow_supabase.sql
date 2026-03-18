-- SQL Script for SushiFlow (Supabase/PostgreSQL)
-- This script creates the core tables: usuarios, produtos, pedidos, rastreamento_entrega, and transacoes.

-- Enable Row Level Security (RLS) and common extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela de Usuários (Unified)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('cliente', 'motoboy', 'admin', 'cozinha')),
    status_disponibilidade BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_usuarios
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- 3. Tabela de Produtos (Cardápio)
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    estoque_ativo BOOLEAN DEFAULT true,
    categoria TEXT,
    imagem_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_produtos
BEFORE UPDATE ON produtos
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- 4. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES usuarios(id),
    motoboy_id UUID REFERENCES usuarios(id),
    valor_itens DECIMAL(10,2) NOT NULL,
    taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_geral DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'pago', 'em_preparo', 'pronto_coleta', 'em_rota', 'entregue', 'cancelado'
    )),
    endereco_entrega JSONB NOT NULL,
    metodo_pagamento TEXT,
    tempo_estimado_minutos INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_pedidos
BEFORE UPDATE ON pedidos
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- 5. Tabela de Rastreamento de Entrega
CREATE TABLE IF NOT EXISTS rastreamento_entrega (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: rastreamento_entrega usually gets frequent updates, so we use ultima_atualizacao directly or a trigger.
CREATE TRIGGER set_timestamp_rastreamento
BEFORE UPDATE ON rastreamento_entrega
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- 6. Tabela de Transações (Carteira Digital)
CREATE TABLE IF NOT EXISTS transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id),
    pedido_id UUID REFERENCES pedidos(id),
    valor DECIMAL(10,2) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('credito_entrega', 'debito_taxa', 'venda_restaurante', 'debito_saque')),
    status TEXT DEFAULT 'disponivel', -- 'disponivel', 'pago_ao_motoboy', 'concluido'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_transacoes
BEFORE UPDATE ON transacoes
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy ON pedidos(motoboy_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_usuario ON transacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_rastreamento_pedido ON rastreamento_entrega(pedido_id);
