async function registrarExecucaoRotina(client, dados) {
  const sql = `
    INSERT INTO mod_scraper.rotinas_agendadas_execucoes (
      rotina_id,
      executada_em,
      status,
      mensagem,
      tarefas_geradas,
      duracao_ms,
      erro
    )
    VALUES ($1, NOW(), $2, $3, $4, $5, $6)
  `;

  await client.query(sql, [
    dados.rotina_id,
    dados.status,
    dados.mensagem || null,
    Number(dados.tarefas_geradas || 0),
    dados.duracao_ms != null ? Number(dados.duracao_ms) : null,
    dados.erro || null
  ]);
}

module.exports = { registrarExecucaoRotina };