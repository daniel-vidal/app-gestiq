-- ============================================================
-- mod-admin | Migration 002 — Seed do usuário admin padrão
-- ============================================================
-- Cria o primeiro usuário administrador para acesso ao sistema.
--
-- IMPORTANTE: Troque a senha após o primeiro login!
--   Email: admin@gestiq.local
--   Senha: Admin@123
--   Hash gerado com bcryptjs (cost 10)
-- ============================================================

INSERT INTO mod_admin.usuarios (nome, email, senha_hash, papel, ativo)
VALUES (
    'Administrador',
    'admin@gestiq.local',
    '$2b$10$uBGNWYVK.DiriqyqA3jX7e70ofZPfataxAuT7etKbKIQtxc77O2l2',
    'admin',
    TRUE
)
ON CONFLICT DO NOTHING;
