const pool = require('../db/pool');

/**
 * Registra uma ação no audit_log.
 *
 * @param {object} dados
 * @param {number|null}  dados.usuario_id    - ID do usuário que fez a ação
 * @param {string}       dados.entidade      - Nome da tabela (ex: 'regioes')
 * @param {number|null}  dados.entidade_id   - ID do registro afetado
 * @param {string}       dados.schema_origem - Schema da tabela (ex: 'mod_scraper')
 * @param {string}       dados.acao          - criar, atualizar, excluir, ativar, desativar, login, logout
 * @param {object|null}  dados.dados_antes   - Snapshot antes da alteração
 * @param {object|null}  dados.dados_depois  - Snapshot depois da alteração
 * @param {string|null}  dados.ip            - IP do request
 * @param {object}       [client]            - pg client (para usar dentro de transação)
 */
async function registrar(dados, client) {
  const sql = `
    INSERT INTO mod_admin.audit_log (
      usuario_id, entidade, entidade_id, schema_origem,
      acao, dados_antes, dados_depois, ip
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;

  const values = [
    dados.usuario_id || null,
    dados.entidade,
    dados.entidade_id || null,
    dados.schema_origem,
    dados.acao,
    dados.dados_antes ? JSON.stringify(dados.dados_antes) : null,
    dados.dados_depois ? JSON.stringify(dados.dados_depois) : null,
    dados.ip || null,
  ];

  const executor = client || pool;
  await executor.query(sql, values);
}

module.exports = { registrar };
