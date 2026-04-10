# mod-admin — Documento de Design

> Módulo de **administração central** do GestiQ.  
> Provê interface visual e API de gestão para os cadastros de **todos os módulos** do sistema.  
> Foco inicial: CRUD sobre as tabelas já existentes e funcionais do **mod_scraper**.  
> O mod-admin **não duplica nem migra** tabelas — ele opera diretamente sobre o schema `mod_scraper` existente.

---

## Índice

1. [Princípio Fundamental](#1-princípio-fundamental)
2. [Tabelas Existentes (mod_scraper) — Gerenciadas pelo Admin](#2-tabelas-existentes-mod_scraper--gerenciadas-pelo-admin)
3. [Tabelas Novas (mod_admin) — Exclusivas do Admin](#3-tabelas-novas-mod_admin--exclusivas-do-admin)
4. [Relações entre Entidades](#4-relações-entre-entidades)
5. [API do Módulo Admin](#5-api-do-módulo-admin)
6. [Telas Mínimas](#6-telas-mínimas)
7. [Fluxo de Uso](#7-fluxo-de-uso)
8. [Decisões de Arquitetura](#8-decisões-de-arquitetura)
9. [Plano de Implementação](#9-plano-de-implementação)

---

## 1. Princípio Fundamental

```
┌─────────────────────────────────────────────────────────┐
│  mod-admin  (API + UI)                                  │
│  Lê e escreve nas tabelas dos outros módulos            │
│  Possui apenas tabelas próprias de acesso e auditoria   │
└──────────────┬──────────────────────────────────────────┘
               │ opera sobre
               ▼
┌─────────────────────────────────────────────────────────┐
│  mod_scraper  (schema existente no banco)               │
│  regioes, hoteis_monitorados, datas_monitoramento,      │
│  scraping_tarefas, tarifas_monitoradas, tarifas_atuais, │
│  hoteis_janela_venda, configuracoes,                    │
│  rotinas_agendadas, rotinas_agendadas_execucoes         │
└─────────────────────────────────────────────────────────┘
```

**Regras:**
- O mod-admin **respeita integralmente** a estrutura de banco do mod_scraper (tipos, nomes, constraints, índices).
- Não cria views, não duplica tabelas, não migra dados entre schemas.
- O schema `mod_admin` contém **apenas** tabelas que não existem em nenhum outro módulo: `usuarios` e `audit_log`.
- Futuramente, quando outros módulos forem criados (mod-rms, mod-agente, etc.), o admin também gerenciará seus cadastros.

---

## 2. Tabelas Existentes (mod_scraper) — Gerenciadas pelo Admin

Estas tabelas já existem e estão em produção. O admin provê CRUD visual respeitando cada campo tal como está definido.

### 2.1 `mod_scraper.regioes`

| Coluna         | Tipo           | Restrição                  | Admin: editável? |
|----------------|----------------|----------------------------|-------------------|
| id             | SERIAL         | PK                         | auto              |
| nome           | VARCHAR(150)   | NOT NULL                   | ✅ sim            |
| cidade         | VARCHAR(120)   | NOT NULL                   | ✅ sim            |
| estado         | CHAR(2)        | NOT NULL                   | ✅ sim            |
| tipo_regiao    | VARCHAR(50)    |                            | ✅ sim (select: bairro, litoral, ilha, orla, centro) |
| ativa          | BOOLEAN        | DEFAULT TRUE               | ✅ sim (toggle)   |
| criada_em      | TIMESTAMP      | DEFAULT NOW()              | auto              |
| atualizada_em  | TIMESTAMP      | DEFAULT NOW()              | auto (trigger)    |

**Chave única:** `(nome, cidade, estado)`

---

### 2.2 `mod_scraper.hoteis_monitorados`

| Coluna                    | Tipo           | Restrição                        | Admin: editável? |
|---------------------------|----------------|----------------------------------|-------------------|
| id                        | SERIAL         | PK                               | auto              |
| nome                      | VARCHAR(200)   | NOT NULL                         | ✅ sim            |
| regiao_id                 | INTEGER        | FK → regioes, NOT NULL           | ✅ sim (select)   |
| categoria_estrelas        | SMALLINT       |                                  | ✅ sim (1-5)      |
| perfil_hotel              | VARCHAR(80)    |                                  | ✅ sim (select: boutique, luxo, resort, pousada, economico) |
| url_booking               | TEXT           | NOT NULL, UNIQUE                 | ✅ sim            |
| ativo                     | BOOLEAN        | DEFAULT TRUE                     | ✅ sim (toggle)   |
| prioridade_monitoramento  | SMALLINT       | DEFAULT 5                        | ✅ sim (1-10)     |
| hotel_base                | BOOLEAN        | DEFAULT FALSE                    | ✅ sim (toggle)   |
| observacoes               | TEXT           |                                  | ✅ sim (textarea) |
| criada_em                 | TIMESTAMP      | DEFAULT NOW()                    | auto              |
| atualizada_em             | TIMESTAMP      | DEFAULT NOW()                    | auto (trigger)    |

**Chave única:** `url_booking`  
**Índices:** `regiao_id`, `ativo`

---

### 2.3 `mod_scraper.datas_monitoramento`

| Coluna              | Tipo           | Restrição                  | Admin: editável? |
|---------------------|----------------|----------------------------|-------------------|
| id                  | SERIAL         | PK                         | auto              |
| data_alvo           | DATE           | NOT NULL                   | ✅ sim (datepicker) |
| tipo_monitoramento  | VARCHAR(50)    | NOT NULL                   | ✅ sim (select: rotina_90_dias, feriado, evento, data_manual, data_critica) |
| prioridade          | SMALLINT       | DEFAULT 5                  | ✅ sim (1-10)     |
| descricao           | VARCHAR(200)   |                            | ✅ sim            |
| ativa               | BOOLEAN        | DEFAULT TRUE               | ✅ sim (toggle)   |
| criada_em           | TIMESTAMP      | DEFAULT NOW()              | auto              |
| atualizada_em       | TIMESTAMP      | DEFAULT NOW()              | auto (trigger)    |

**Chave única:** `(data_alvo, tipo_monitoramento, COALESCE(descricao, ''))`

---

### 2.4 `mod_scraper.configuracoes`

| Coluna         | Tipo           | Restrição      | Admin: editável? |
|----------------|----------------|----------------|-------------------|
| chave          | VARCHAR(100)   | PK             | ✅ sim (input)    |
| valor          | VARCHAR(500)   | NOT NULL       | ✅ sim (input)    |
| descricao      | TEXT           |                | ✅ sim (textarea) |
| atualizado_em  | TIMESTAMP      | DEFAULT NOW()  | auto              |

---

### 2.5 `mod_scraper.rotinas_agendadas`

| Coluna              | Tipo           | Restrição                          | Admin: editável?    |
|---------------------|----------------|------------------------------------|----------------------|
| id                  | BIGSERIAL      | PK                                 | auto                 |
| nome                | VARCHAR(150)   | NOT NULL                           | ✅ sim               |
| tipo_rotina         | VARCHAR(60)    | NOT NULL                           | ✅ sim (select)      |
| ativo               | BOOLEAN        | DEFAULT TRUE                       | ✅ sim (toggle)      |
| script_gerador      | VARCHAR(255)   | NOT NULL                           | ✅ sim (select)      |
| parametros_json     | JSONB          | DEFAULT '{}'                       | ✅ sim (JSON editor) |
| frequencia_tipo     | VARCHAR(30)    | CHECK (minutos/horas/diaria/semanal/mensal) | ✅ sim (select) |
| frequencia_valor    | INTEGER        | DEFAULT 1, CHECK > 0              | ✅ sim               |
| hora_inicio         | TIME           |                                    | ✅ sim               |
| hora_fim            | TIME           |                                    | ✅ sim               |
| dias_semana         | SMALLINT[]     |                                    | ✅ sim (checkboxes)  |
| prioridade          | INTEGER        | DEFAULT 5, CHECK >= 0             | ✅ sim               |
| ultima_execucao_em  | TIMESTAMP      |                                    | somente leitura      |
| proxima_execucao_em | TIMESTAMP      |                                    | somente leitura      |
| total_execucoes     | INTEGER        | DEFAULT 0                          | somente leitura      |
| total_dias_execucao | INTEGER        | DEFAULT 0                          | somente leitura      |
| criado_em           | TIMESTAMP      | DEFAULT NOW()                      | auto                 |
| atualizada_em       | TIMESTAMP      | DEFAULT NOW()                      | auto (trigger)       |

---

### 2.6 `mod_scraper.rotinas_agendadas_execucoes` (somente leitura)

| Coluna          | Tipo       | Descrição                  | Admin         |
|-----------------|------------|----------------------------|---------------|
| id              | BIGSERIAL  | PK                         | somente leitura |
| rotina_id       | BIGINT     | FK → rotinas_agendadas     | somente leitura |
| executada_em    | TIMESTAMP  |                            | somente leitura |
| status          | VARCHAR(30)| sucesso, erro, ignorada    | somente leitura |
| mensagem        | TEXT       |                            | somente leitura |
| tarefas_geradas | INTEGER    |                            | somente leitura |
| duracao_ms      | BIGINT     |                            | somente leitura |
| erro            | TEXT       |                            | somente leitura |

---

### 2.7 `mod_scraper.scraping_tarefas` (somente leitura / ações pontuais)

O admin exibe a fila de tarefas para monitoramento. Não cria tarefas diretamente (isso é feito pelas rotinas).

| Dado exibido              | Ação no admin                          |
|---------------------------|----------------------------------------|
| Resumo da fila (contadores por status) | Dashboard                    |
| Lista de tarefas com erro | Listar com filtro `status = 'erro'`    |
| Detalhe de uma tarefa     | Visualizar payload, erro_resumo        |
| Reprocessar tarefa        | Reset status → 'pendente', tentativas = 0 |
| Cancelar tarefa           | Status → 'cancelada'                   |

---

### 2.8 `mod_scraper.tarifas_monitoradas` e `tarifas_atuais` (somente leitura)

Visualização via admin para conferência. Sem CRUD — dados são gerados pelo pipeline de scraping.

### 2.9 `mod_scraper.hoteis_janela_venda` (somente leitura)

Exibe análise de janela de venda por hotel no detalhe do hotel.

---

## 3. Tabelas Novas (mod_admin) — Exclusivas do Admin

Schema: **`mod_admin`** — contém apenas o que não existe em nenhum outro módulo.

### 3.1 `mod_admin.usuarios`

| Coluna           | Tipo           | Restrição          | Descrição                              |
|------------------|----------------|--------------------|----------------------------------------|
| id               | SERIAL         | PK                 |                                        |
| nome             | VARCHAR(150)   | NOT NULL           | Nome completo                          |
| email            | VARCHAR(200)   | UNIQUE NOT NULL    | Login                                  |
| senha_hash       | VARCHAR(255)   | NOT NULL           | bcrypt hash                            |
| papel            | VARCHAR(30)    | DEFAULT 'operador' | admin, gerente, operador               |
| ativo            | BOOLEAN        | DEFAULT TRUE       |                                        |
| ultimo_login_em  | TIMESTAMP      |                    | Último login bem-sucedido              |
| criado_em        | TIMESTAMP      | DEFAULT NOW()      |                                        |
| atualizado_em    | TIMESTAMP      | DEFAULT NOW()      |                                        |

**Índices:** `email` (unique), `ativo`  
**Constraints:** `CHECK (papel IN ('admin', 'gerente', 'operador'))`

**Papéis:**
- **admin** — acesso total, gerencia usuários e configurações
- **gerente** — gerencia hotéis, regiões, rotinas, visualiza tudo
- **operador** — visualiza dashboards e relatórios, sem edição

---

### 3.2 `mod_admin.audit_log`

| Coluna          | Tipo           | Restrição       | Descrição                          |
|-----------------|----------------|-----------------|------------------------------------|
| id              | BIGSERIAL      | PK              |                                    |
| usuario_id      | INTEGER        | FK → usuarios   | Quem fez (NULL se sistema)         |
| entidade        | VARCHAR(100)   | NOT NULL        | Ex: 'hoteis_monitorados'           |
| entidade_id     | BIGINT         |                 | ID do registro afetado             |
| schema_origem   | VARCHAR(50)    | NOT NULL        | Ex: 'mod_scraper'                  |
| acao            | VARCHAR(30)    | NOT NULL        | criar, atualizar, excluir, login   |
| dados_antes     | JSONB          |                 | Snapshot antes (em updates/deletes)|
| dados_depois    | JSONB          |                 | Snapshot depois (em creates/updates)|
| ip              | INET           |                 | IP do request                      |
| criado_em       | TIMESTAMP      | DEFAULT NOW()   |                                    |

**Índices:** `(entidade, criado_em DESC)`, `(usuario_id, criado_em DESC)`

> O campo `schema_origem` indica de qual módulo é a tabela afetada. Isso permite que o audit_log sirva para todos os módulos futuros.

---

## 4. Relações entre Entidades

```
mod_admin (schema próprio — acesso e auditoria)
 ├── usuarios .................. Cadastro de quem acessa o sistema
 └── audit_log ................. Log de toda ação feita via admin
      └── usuario_id → usuarios

mod_scraper (schema existente — gerenciado pelo admin)
 ├── regioes
 │    └── hoteis_monitorados ......... N:1 (cada hotel pertence a 1 região)
 │         ├── scraping_tarefas ...... N:1 (tarefas de scraping do hotel)
 │         ├── tarifas_monitoradas ... N:1 (histórico de preços)
 │         ├── tarifas_atuais ........ N:1 (snapshot atual de preços)
 │         └── hoteis_janela_venda ... 1:1 (análise de janela de venda)
 ├── datas_monitoramento ............ Independente (datas especiais)
 ├── configuracoes .................. Independente (key-value)
 ├── rotinas_agendadas
 │    └── rotinas_agendadas_execucoes .. N:1 (histórico de runs)
 ├── scraping_tarefas
 │    ├── tarifas_monitoradas ........ N:1 (tarifa origina de tarefa)
 │    └── tarifas_atuais ............. N:1
 └── tarifas_monitoradas
      └── tarifas_atuais ............. N:1 (historico_id)
```

### Regras de integridade (existentes no mod_scraper — o admin respeita)

| FK                                          | ON DELETE | Nota                              |
|---------------------------------------------|-----------|-----------------------------------|
| hoteis_monitorados.regiao_id → regioes      | RESTRICT  | Não deletar região com hotéis     |
| scraping_tarefas.hotel_id → hoteis_monit.   | RESTRICT  | Não deletar hotel com tarefas     |
| tarifas_monitoradas.hotel_id → hoteis_monit.| RESTRICT  |                                   |
| tarifas_atuais.historico_id → tarifas_monit.| RESTRICT  |                                   |
| rotinas_exec.rotina_id → rotinas_agendadas  | CASCADE   | Deletar rotina remove execuções   |
| audit_log.usuario_id → usuarios             | SET NULL  | Manter log mesmo se user deletado |

> O admin usa **soft delete** (ativo/ativa = false) para hotéis, regiões e rotinas — nunca DELETE físico em entidades com dependências.

---

## 5. API do Módulo Admin

Base: `/api/admin/...`  
Autenticação: JWT (header `Authorization: Bearer <token>`)

### 5.1 Autenticação

| Método | Rota                 | Descrição                  | Papel mínimo |
|--------|----------------------|----------------------------|--------------|
| POST   | /auth/login          | Login (email + senha) → JWT| público      |
| POST   | /auth/logout         | Invalidar token            | qualquer     |
| GET    | /auth/me             | Perfil do usuário logado   | qualquer     |
| PUT    | /auth/me/senha       | Alterar própria senha      | qualquer     |

### 5.2 Regiões — `mod_scraper.regioes`

| Método | Rota            | Descrição                       | Papel mínimo |
|--------|-----------------|---------------------------------|--------------|
| GET    | /regioes        | Listar (filtro: ativa, estado)  | operador     |
| POST   | /regioes        | Criar região                    | gerente      |
| GET    | /regioes/:id    | Detalhar (com contagem hotéis)  | operador     |
| PUT    | /regioes/:id    | Atualizar                       | gerente      |
| DELETE | /regioes/:id    | Desativar (ativa = false)       | admin        |

### 5.3 Hotéis — `mod_scraper.hoteis_monitorados`

| Método | Rota                       | Descrição                                | Papel mínimo |
|--------|----------------------------|------------------------------------------|--------------|
| GET    | /hoteis                    | Listar (filtros: regiao, ativo, base)    | operador     |
| POST   | /hoteis                    | Cadastrar hotel                          | gerente      |
| GET    | /hoteis/:id                | Detalhar (com janela_venda, tarefas)     | operador     |
| PUT    | /hoteis/:id                | Atualizar hotel                          | gerente      |
| DELETE | /hoteis/:id                | Desativar (ativo = false)                | admin        |
| GET    | /hoteis/:id/tarefas        | Tarefas de scraping do hotel             | operador     |
| GET    | /hoteis/:id/janela-venda   | Dados de janela de venda                 | operador     |

### 5.4 Datas de Monitoramento — `mod_scraper.datas_monitoramento`

| Método | Rota                      | Descrição                               | Papel mínimo |
|--------|---------------------------|-----------------------------------------|--------------|
| GET    | /datas-monitoramento      | Listar (filtros: tipo, ativa, período)  | operador     |
| POST   | /datas-monitoramento      | Criar data especial                     | gerente      |
| GET    | /datas-monitoramento/:id  | Detalhar                                | operador     |
| PUT    | /datas-monitoramento/:id  | Atualizar                               | gerente      |
| DELETE | /datas-monitoramento/:id  | Desativar (ativa = false)               | gerente      |

### 5.5 Rotinas Agendadas — `mod_scraper.rotinas_agendadas`

| Método | Rota                        | Descrição                               | Papel mínimo |
|--------|-----------------------------|-----------------------------------------|--------------|
| GET    | /rotinas                    | Listar rotinas                          | operador     |
| POST   | /rotinas                    | Criar rotina                            | gerente      |
| GET    | /rotinas/:id                | Detalhar (com últimas execuções)        | operador     |
| PUT    | /rotinas/:id                | Atualizar (nome, frequência, ativo...) | gerente      |
| PATCH  | /rotinas/:id/ativo          | Toggle ativar/desativar                 | gerente      |
| POST   | /rotinas/:id/executar       | Forçar execução (proxima_execucao = NOW)| gerente      |
| GET    | /rotinas/:id/execucoes      | Histórico de execuções                  | operador     |

### 5.6 Configurações — `mod_scraper.configuracoes`

| Método | Rota                   | Descrição                  | Papel mínimo |
|--------|------------------------|----------------------------|--------------|
| GET    | /configuracoes         | Listar todas               | gerente      |
| GET    | /configuracoes/:chave  | Buscar por chave           | gerente      |
| PUT    | /configuracoes/:chave  | Atualizar valor            | admin        |
| POST   | /configuracoes         | Criar nova configuração    | admin        |
| DELETE | /configuracoes/:chave  | Excluir configuração       | admin        |

### 5.7 Fila de Scraping — `mod_scraper.scraping_tarefas` (monitoramento)

| Método | Rota                          | Descrição                          | Papel mínimo |
|--------|-------------------------------|------------------------------------|--------------|
| GET    | /scraping/resumo              | Contadores por status              | operador     |
| GET    | /scraping/tarefas             | Listar tarefas (filtros: status, hotel, período) | operador |
| GET    | /scraping/tarefas/:id         | Detalhar tarefa                    | operador     |
| POST   | /scraping/tarefas/:id/retry   | Reprocessar (status→pendente)      | gerente      |
| POST   | /scraping/tarefas/:id/cancelar| Cancelar tarefa                    | gerente      |

### 5.8 Usuários — `mod_admin.usuarios`

| Método | Rota              | Descrição                  | Papel mínimo |
|--------|-------------------|----------------------------|--------------|
| GET    | /usuarios         | Listar usuários            | admin        |
| POST   | /usuarios         | Criar usuário              | admin        |
| GET    | /usuarios/:id     | Detalhar                   | admin        |
| PUT    | /usuarios/:id     | Atualizar                  | admin        |
| DELETE | /usuarios/:id     | Desativar (ativo = false)  | admin        |

### 5.9 Audit Log — `mod_admin.audit_log`

| Método | Rota          | Descrição                           | Papel mínimo |
|--------|---------------|-------------------------------------|--------------|
| GET    | /audit-log    | Listar (filtros: entidade, usuario, período) | admin |

---

## 6. Telas Mínimas

### 6.1 Mapa de Telas (MVP)

```
Login
 └── Dashboard (home)
      ├── Regiões
      │    ├── Lista de Regiões
      │    └── Cadastro/Edição de Região
      ├── Hotéis
      │    ├── Lista de Hotéis
      │    ├── Cadastro/Edição de Hotel
      │    └── Detalhe do Hotel (janela venda, tarefas)
      ├── Datas de Monitoramento
      │    ├── Lista/Calendário de Datas
      │    └── Cadastro/Edição de Data
      ├── Rotinas Agendadas
      │    ├── Lista de Rotinas (com toggle ativo)
      │    ├── Cadastro/Edição de Rotina
      │    └── Histórico de Execuções
      ├── Fila de Scraping
      │    ├── Resumo (contadores por status)
      │    └── Lista de Tarefas (com filtros)
      ├── Configurações
      │    └── Lista de parâmetros (key-value)
      ├── Usuários (admin only)
      │    ├── Lista de Usuários
      │    └── Cadastro/Edição de Usuário
      └── Audit Log (admin only)
           └── Lista de ações com filtros
```

### 6.2 Detalhamento por Tela

#### Login
- Campos: email, senha
- Ação: `POST /auth/login` → armazena JWT
- Redirect: Dashboard

#### Dashboard
- **Card Hotéis:** total ativos / inativos, hotel_base destacado
- **Card Fila de Scraping:** pendentes, processando, com erro, concluídas hoje
- **Card Rotinas:** ativas, próxima execução, última execução com erro
- **Card Datas:** próximas datas especiais (feriados, eventos)
- Links rápidos para ações frequentes

#### Lista de Regiões
- Tabela: nome, cidade, estado, tipo_regiao, qtd hotéis vinculados, ativa, ações
- Filtro: estado, ativa
- Botão "Nova Região"

#### Cadastro/Edição de Região
- Campos: nome, cidade, estado (select UFs), tipo_regiao (select), ativa (toggle)
- Validação: nome + cidade + estado obrigatórios, unicidade

#### Lista de Hotéis
- Tabela: nome, região, categoria_estrelas, perfil, prioridade, hotel_base, ativo, ações
- Filtros: região (select), ativo, hotel_base, perfil
- Busca por nome
- Botão "Novo Hotel"

#### Cadastro/Edição de Hotel
- Campos: nome, regiao_id (select), categoria_estrelas (1-5), perfil_hotel (select), url_booking, prioridade (1-10), hotel_base (toggle), ativo (toggle), observacoes (textarea)
- Validação: nome e url_booking obrigatórios, URL única

#### Detalhe do Hotel
- Dados cadastrais do hotel
- **Seção Janela de Venda:** dados de `hoteis_janela_venda` (somente leitura)
- **Seção Tarefas Recentes:** últimas tarefas de scraping do hotel
- **Seção Tarifas Atuais:** snapshot de preços vigentes (somente leitura)

#### Datas de Monitoramento
- Tabela: data_alvo, tipo_monitoramento, descrição, prioridade, ativa
- Filtros: tipo, período, ativa
- Visualização calendário (futuro)
- Botão "Nova Data"

#### Rotinas Agendadas
- Tabela: nome, tipo_rotina, frequência, próxima execução, última execução (status + duração), ativo
- **Toggle inline** ativo/inativo
- **Botão "Executar Agora"** (força proxima_execucao_em = NOW)
- Expandir: últimas 10 execuções com status, tarefas_geradas, duracao_ms, erro

#### Fila de Scraping
- **Cards resumo:** pendentes, processando, concluídas, com erro (contadores)
- Tabela: hotel, mes_referencia, status, tentativas, worker, agendada_para, erro
- Filtros: status, hotel, período
- Ação: reprocessar (reset para pendente), cancelar

#### Configurações
- Tabela editável: chave, valor, descrição
- Ações: editar valor, criar nova, excluir

#### Usuários (admin only)
- Tabela: nome, email, papel, ativo, último login
- CRUD completo

---

## 7. Fluxo de Uso

### 7.1 Setup Inicial (primeiro acesso)

```
1. Rodar seed: cria usuário admin padrão
2. Login com admin
3. Cadastrar regiões      →  ex: "Morro de São Paulo", Cairu, BA, litoral
4. Cadastrar hotel base   →  "Hotel Praia da Sereia" (hotel_base = true)
5. Cadastrar concorrentes →  hotéis da mesma região
6. Revisar configurações  →  ajustar parâmetros do scraper se necessário
7. Criar rotina agendada  →  geração de tarefas 90 dias, frequência diária
8. Rotina executa automaticamente via loop do mod-scraper
```

### 7.2 Fluxo Diário (operação)

```
1. Login
2. Dashboard mostra:
   - 15 hotéis monitorados, 850 tarefas concluídas, 3 com erro
   - Próxima rotina em 2h
   - 2 datas especiais nos próximos 7 dias
3. Fila de Scraping → filtra tarefas com erro
4. Reprocessa tarefas problemáticas
5. Rotinas → verifica se todas estão ativas e com próxima execução correta
```

### 7.3 Adicionar Novo Concorrente

```
1. Hotéis → Novo Hotel
2. Preenche: nome, URL Booking, região, prioridade, perfil, estrelas
3. Salva → hotel aparece na listagem
4. Rotina de geração de tarefas (já existente) detecta o novo hotel ativo
5. Próxima execução da rotina gera tarefas de scraping para ele
6. Worker coleta as tarifas automaticamente
```

### 7.4 Cadastrar Data Especial

```
1. Datas de Monitoramento → Nova Data
2. Tipo: feriado | Data: 2026-06-15 | Descrição: "São João" | Prioridade: 2
3. Salva
4. Rotinas que usam datas de monitoramento passam a incluir essa data
```

### 7.5 Gestão de Rotinas

```
1. Rotinas Agendadas → lista todas
2. Rotina "Geração 90 dias" com erro na última execução
3. Clica para expandir → vê detalhes do erro
4. Corrige o problema (ex: hotel inativo referenciado)
5. Clica "Executar Agora" → força nova execução
6. Acompanha na lista de execuções
```

---

## 8. Decisões de Arquitetura

### 8.1 Dois schemas, responsabilidades claras

| Schema       | Contém                                  | Quem escreve         |
|--------------|-----------------------------------------|-----------------------|
| `mod_scraper`| Todas as tabelas de negócio do scraper  | mod-admin (CRUD) + mod-scraper (pipeline) |
| `mod_admin`  | Apenas `usuarios` e `audit_log`         | mod-admin exclusivamente |

### 8.2 Sem duplicação de dados

O admin **não cria** tabelas paralelas (ex: não cria `mod_admin.hoteis` separada). Ele opera diretamente em `mod_scraper.hoteis_monitorados`. Isso evita:
- Sincronismo entre schemas
- Inconsistência de dados
- Complexidade de views/triggers

### 8.3 Soft delete padrão

Entidades com dependências (hotéis, regiões, rotinas) usam `ativo/ativa = false` via admin. O admin **nunca** faz DELETE físico nessas tabelas.

Entidades sem dependências (configurações, datas de monitoramento) podem ter DELETE físico.

### 8.4 Convenções alinhadas com mod_scraper

O admin segue as mesmas convenções do banco existente:

| Item         | Convenção mod_scraper         | Admin segue    |
|--------------|-------------------------------|----------------|
| Tipos        | VARCHAR(N), SMALLINT, etc.    | ✅ idêntico    |
| Timestamps   | TIMESTAMP (sem timezone)      | ✅ idêntico    |
| Nomes        | snake_case, português         | ✅ idêntico    |
| Booleanos    | ativo/ativa                   | ✅ idêntico    |
| Auto-update  | Trigger fn_set_atualizada_em  | ✅ reutiliza   |

### 8.5 Stack técnica

| Camada     | Escolha                        | Justificativa                         |
|------------|--------------------------------|---------------------------------------|
| API        | Express.js                     | Já no projeto (dependência mínima)    |
| Auth       | JWT + bcrypt                   | Simples, stateless                    |
| Banco      | PostgreSQL (pg) — pool do projeto | Mesmo pool de conexão              |
| Frontend   | HTML + JS vanilla (ou HTMX)   | Sem build step, fase 1 simples        |
| Validação  | Helper leve                    | Sem dependência extra                 |

### 8.6 Estrutura de pastas

```
mod-admin/
  DESIGN.md                  ← este documento
  iniciarModAdmin.js         ← bootstrap Express
  src/
    db/
      pool.js                ← reusa config .env do projeto
      migrations/
        001_mod_admin_schema.sql   ← apenas usuarios + audit_log
        002_seed_admin.sql         ← usuário admin inicial
    auth/
      login.js
      middleware.js            ← JWT + verificação de papel
      hash.js                  ← bcrypt helpers
    rotas/
      regioes.js               ← CRUD em mod_scraper.regioes
      hoteis.js                ← CRUD em mod_scraper.hoteis_monitorados
      datas-monitoramento.js   ← CRUD em mod_scraper.datas_monitoramento
      rotinas.js               ← CRUD em mod_scraper.rotinas_agendadas
      configuracoes.js         ← CRUD em mod_scraper.configuracoes
      scraping.js              ← leitura/ações em mod_scraper.scraping_tarefas
      usuarios.js              ← CRUD em mod_admin.usuarios
      audit-log.js             ← leitura de mod_admin.audit_log
    servicos/
      auditoria.js             ← registrar ações no audit_log
    painel/
      public/
        index.html             ← SPA leve ou páginas separadas
        login.html
        css/
        js/
```

### 8.7 Preparação para SaaS (futura)

Quando for o momento de multi-tenant:
1. Adicionar `organizacao_id` nas tabelas do mod_scraper (ALTER TABLE)
2. Adicionar `organizacao_id` em `mod_admin.usuarios` e `audit_log`
3. Middleware filtra por organizacao_id do token JWT
4. Opcionalmente ativar RLS no PostgreSQL

**Hoje não se implementa nada disso** — o código apenas não cria impedimentos para essa evolução.

---

## 9. Plano de Implementação

### Fase 1 — Fundação + CRUDs do Scraper

| #  | Etapa                                   | Opera em                            |
|----|-----------------------------------------|-------------------------------------|
| 1  | Migration: schema mod_admin             | `mod_admin.usuarios`, `audit_log`   |
| 2  | Seed: usuário admin                     | `mod_admin.usuarios`                |
| 3  | Auth: login, JWT, middleware de papéis  | `mod_admin.usuarios`                |
| 4  | CRUD Regiões                            | `mod_scraper.regioes`               |
| 5  | CRUD Hotéis                             | `mod_scraper.hoteis_monitorados`    |
| 6  | CRUD Datas de Monitoramento             | `mod_scraper.datas_monitoramento`   |
| 7  | CRUD Rotinas Agendadas                  | `mod_scraper.rotinas_agendadas`     |
| 8  | Leitura: Execuções de Rotinas           | `mod_scraper.rotinas_agendadas_execucoes` |

### Fase 2 — Monitoramento + Gestão

| #  | Etapa                                   | Opera em                            |
|----|-----------------------------------------|-------------------------------------|
| 9  | CRUD Configurações                      | `mod_scraper.configuracoes`         |
| 10 | Monitoramento: Fila de Scraping         | `mod_scraper.scraping_tarefas`      |
| 11 | Visualização: Detalhe Hotel + janela    | `mod_scraper.hoteis_janela_venda`   |
| 12 | CRUD Usuários                           | `mod_admin.usuarios`                |
| 13 | Audit Log                               | `mod_admin.audit_log`               |
| 14 | Dashboard com resumos                   | queries agregadas                   |

### Fase 3 — Próximos módulos

| #  | Etapa                                   | Descrição                           |
|----|-----------------------------------------|-------------------------------------|
| 15 | Admin do mod-rms                        | Quando mod-rms existir              |
| 16 | Admin do mod-agente                     | Quando mod-agente existir           |
| 17 | Multi-tenant / SaaS                     | Quando necessário                   |

---

## Convenções

- **SQL:** respeitar tipos e nomes exatos do mod_scraper existente
- **API:** kebab-case nas URLs, camelCase no JSON de response
- **Timestamps:** TIMESTAMP (sem timezone) — padrão do projeto
- **Soft delete:** ativo/ativa = false para entidades com dependências
- **Auditoria:** toda mutação via admin grava em `mod_admin.audit_log`
- **Pool:** reutilizar a mesma conexão PostgreSQL do projeto
