# app-gestiq — visão geral

Monorepo com módulos para captura, processamento e persistência de tarifas de hotéis.

Principais pastas
- `mod-scraper/` — módulo principal de scraping e agendamento (Node.js).
- `mod-wificonnect/` — utilitários e exemplos relacionados ao wificonnect.
- `mod-admin/` — módulo responsável pelos cadastros e configurações do sistema (administração).
- `mod-rms/` — módulo responsável pela visualização, comparação de dados e flutuação dos hotéis.
- `server.js`, `package.json` — arquivos na raiz para integração/execução do serviço principal.

Como executar

- Executar o módulo scraper a partir da raiz (recomendado):
```powershell
node mod-scraper/iniciarModScraper.js
```
- Ou executar a partir da pasta `mod-scraper`:
```powershell
cd mod-scraper
node iniciarModScraper.js
```

Variáveis de ambiente (arquivo `.env` na raiz)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — conexão Postgres.
- `PGPASSWORD` também é aceito como alternativa a `DB_PASSWORD`.
- Agendador / worker:
        - `AGENDADOR_INTERVALO_MS` (padrão `30000`)
        - `AGENDADOR_DEBUG` (`true|false`)
        - `WORKER_INTERVALO_MS` (padrão `3000`)
        - `WORKER_DEBUG` (`true|false`)
        - `WORKER_NOME`

Dica: se quiser ver um log mascarado da presença da senha DB (sem expor valor), defina `DEBUG_DB_PASSWORD=true`.

Como o agendador funciona (resumo)
- O agendador consulta `mod_scraper.rotinas_agendadas` buscando rotinas ativas cuja `proxima_execucao_em IS NULL OR proxima_execucao_em <= NOW()`.
- `hora_inicio` / `hora_fim` aceitam formatos `HH:MM` ou `HH:MM:SS` e são usadas para aplicar restrições diárias.
- `proxima_execucao_em` é um timestamp concreto que determina se a rotina será executada imediatamente.

Scripts úteis no módulo `mod-scraper`
- `src/tarefas/gerar_tarefas_90_dias.js` — gera tarefas de scraping para 90 dias. Exemplos:
        - `node src/tarefas/gerar_tarefas_90_dias.js --debug`
        - `node src/tarefas/gerar_tarefas_90_dias.js --debug --agendada-para="2026-03-24 06:00:00"`

Verificações e debugging
- Consultar rotinas com `hora_inicio = '14:12'`:
```sql
SELECT id, nome, frequencia_tipo, hora_inicio, dias_semana, proxima_execucao_em
FROM mod_scraper.rotinas_agendadas
WHERE hora_inicio = '14:12';
```
- Forçar execução agora (teste):
```sql
UPDATE mod_scraper.rotinas_agendadas
SET proxima_execucao_em = NULL
WHERE id = <ID_DA_ROTINA>;
```

Pontos importantes
- Execute o scraper a partir da raiz ou carregue explicitamente o `.env` (o arquivo `.env` está na raiz). O comportamento do `dotenv` depende do diretório de trabalho atual — já ajustamos `mod-scraper/iniciarModScraper.js` para carregar o `.env` da raiz.
- O pool de conexão ao Postgres aceita `DB_PASSWORD` ou `PGPASSWORD`; problemas de autenticação podem aparecer se a variável de ambiente não for carregada ou se não for uma string. Há coerção para string em `mod-scraper/src/db/pool.js`.

Estrutura resumida (`mod-scraper/src`)
- `agendamento/` — loop do agendador, cálculo de próxima execução, execução de rotinas.
- `tarefas/` — scripts que geram e executam tarefas de scraping.
- `db/` — pool de conexões (`pool.js`).
- `captura/`, `parser/`, `persistencia/`, `painel/`, `consulta/` — responsabilidades óbvias por nome.

Se quiser, eu posso:
- gerar exemplos de queries para identificar rotinas inválidas de `hora_inicio`, ou
- adicionar uma rotina de verificação que logue rotinas com `hora_inicio` em formato inválido.