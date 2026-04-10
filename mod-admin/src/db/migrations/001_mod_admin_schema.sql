-- ============================================================
-- mod-admin | Migration 001 — Schema e tabelas do módulo admin
-- ============================================================
-- Cria apenas as tabelas exclusivas do admin: usuarios e audit_log.
-- As tabelas de negócio (hotéis, regiões, rotinas etc.) permanecem
-- no schema mod_scraper e são acessadas diretamente pelo admin.
-- ============================================================

-- Schema
CREATE SCHEMA IF NOT EXISTS mod_admin;


---------------------------------------------------
-- USUARIOS
---------------------------------------------------

CREATE TABLE IF NOT EXISTS mod_admin.usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(200) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    papel VARCHAR(30) NOT NULL DEFAULT 'operador',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login_em TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_usuarios_papel
        CHECK (papel IN ('admin', 'gerente', 'operador'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mod_admin_usuarios_email
    ON mod_admin.usuarios (email);

CREATE INDEX IF NOT EXISTS ix_mod_admin_usuarios_ativo
    ON mod_admin.usuarios (ativo);


---------------------------------------------------
-- AUDIT LOG
---------------------------------------------------

CREATE TABLE IF NOT EXISTS mod_admin.audit_log (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES mod_admin.usuarios(id) ON DELETE SET NULL,
    entidade VARCHAR(100) NOT NULL,
    entidade_id BIGINT,
    schema_origem VARCHAR(50) NOT NULL,
    acao VARCHAR(30) NOT NULL,
    dados_antes JSONB,
    dados_depois JSONB,
    ip INET,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_audit_log_acao
        CHECK (acao IN ('criar', 'atualizar', 'excluir', 'login', 'logout', 'ativar', 'desativar', 'executar_agora'))
);

CREATE INDEX IF NOT EXISTS ix_mod_admin_audit_log_entidade
    ON mod_admin.audit_log (entidade, criado_em DESC);

CREATE INDEX IF NOT EXISTS ix_mod_admin_audit_log_usuario
    ON mod_admin.audit_log (usuario_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS ix_mod_admin_audit_log_schema
    ON mod_admin.audit_log (schema_origem, criado_em DESC);


---------------------------------------------------
-- TRIGGER: atualizado_em automático
---------------------------------------------------
-- Reutiliza a mesma lógica do mod_scraper.fn_set_atualizada_em().
-- Criamos uma cópia no schema mod_admin para independência entre módulos.

CREATE OR REPLACE FUNCTION mod_admin.fn_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_set_atualizado_em
    ON mod_admin.usuarios;

CREATE TRIGGER trg_usuarios_set_atualizado_em
    BEFORE UPDATE ON mod_admin.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION mod_admin.fn_set_atualizado_em();
