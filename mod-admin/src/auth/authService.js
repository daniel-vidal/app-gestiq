const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'gestiq-dev-secret-trocar-em-producao';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_ROUNDS = 10;

async function buscarUsuarioPorEmail(email) {
  const sql = `
    SELECT id, nome, email, senha_hash, papel, ativo, ultimo_login_em
    FROM mod_admin.usuarios
    WHERE email = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [email]);
  return rows[0] || null;
}

async function buscarUsuarioPorId(id) {
  const sql = `
    SELECT id, nome, email, papel, ativo, ultimo_login_em, criado_em
    FROM mod_admin.usuarios
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function verificarSenha(senhaTexto, senhaHash) {
  return bcrypt.compare(senhaTexto, senhaHash);
}

async function gerarHash(senhaTexto) {
  return bcrypt.hash(senhaTexto, BCRYPT_ROUNDS);
}

function gerarToken(usuario) {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    papel: usuario.papel,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function registrarLogin(usuarioId) {
  const sql = `
    UPDATE mod_admin.usuarios
    SET ultimo_login_em = NOW()
    WHERE id = $1
  `;
  await pool.query(sql, [usuarioId]);
}

async function atualizarSenha(usuarioId, novaSenhaTexto) {
  const hash = await gerarHash(novaSenhaTexto);
  const sql = `
    UPDATE mod_admin.usuarios
    SET senha_hash = $2
    WHERE id = $1
  `;
  await pool.query(sql, [usuarioId, hash]);
}

module.exports = {
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  verificarSenha,
  gerarHash,
  gerarToken,
  verificarToken,
  registrarLogin,
  atualizarSenha,
};
