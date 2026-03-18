# mod-wificonnect

Módulo do **GestIQ** responsável pelo gerenciamento de acesso Wi-Fi para hóspedes e visitantes utilizando portal cativo integrado ao **MikroTik RouterOS**.

O objetivo do módulo é substituir o modelo tradicional de Wi-Fi com senha compartilhada por um sistema inteligente de autenticação, registro de uso e integração com dados do hotel.

Este módulo também pode evoluir para um produto SaaS independente dentro do ecossistema GestIQ.

---

# Objetivos do módulo

* Controlar acesso Wi-Fi de hóspedes e visitantes
* Registrar uso da rede para segurança e auditoria
* Identificar visitantes através de **WhatsApp**
* Evitar abuso de rede (tempo, reconexões, múltiplos dispositivos)
* Integrar com sistemas do hotel (check-in / checkout)
* Gerar dados de presença e uso da rede
* Possibilitar futuras ações de marketing ou relacionamento

---

# Problema que resolve

Modelo comum de Wi-Fi em hotéis:

SSID: HotelWiFi
Senha: 12345678

ou

Portal simples:

[ Entrar como visitante ]

Problemas:

* não identifica o usuário
* sem registro de contato
* MAC randomizado quebra controle
* visitantes podem reconectar indefinidamente
* nenhum dado analítico

---

# Solução proposta

Sistema de autenticação Wi-Fi baseado em:

* Portal cativo
* Validação por WhatsApp
* Tokens de acesso temporários
* Registro completo de conexão
* Integração com MikroTik Hotspot

---

# Fluxo de acesso visitante

1. Usuário conecta no Wi-Fi
2. Portal cativo abre automaticamente
3. Usuário seleciona **Visitante**
4. Digita número de WhatsApp
5. Sistema gera token de acesso
6. Link é enviado via WhatsApp
7. Usuário clica no link
8. Backend libera acesso no MikroTik
9. Internet liberada por período limitado

Exemplo de mensagem enviada:

Hotel Praia da Sereia
Clique para acessar o Wi-Fi visitante:
https://wifi.hotel/acesso/7H3K92
Validade: 4 horas

---

# Fluxo para hóspedes (futuro)

* integração com sistema de reservas
* liberação automática no check-in
* expiração automática no checkout

---

# Registro de acesso

O sistema registra dados básicos da sessão:

telefone
MAC address
IP
tipo de acesso
hora_inicio
hora_fim
duracao
token

Exemplo:

telefone: +55 71 98888-7777
mac: 4C:11:AE:22:88:10
ip: 192.168.50.23
inicio: 18:21
expira: 22:21

---

# Controle de uso

Configuração inicial sugerida.

Visitantes:

tempo máximo: 4h
limite por dia: 1 acesso
dispositivos: 2
velocidade: 10 Mbps

Hóspedes:

tempo: ilimitado
dispositivos: até 5
velocidade: 50-100 Mbps

---

# Estrutura do módulo

mod-wificonnect/

api/
 liberar_acesso.js
 registrar_visitante.js
 enviar_whatsapp.js

portal/
 index.html
 visitante.html
 hospede.html

services/
 token_service.js
 whatsapp_service.js

mikrotik/
 hotspot_api.js

README.md

---

# Integração com MikroTik

O acesso é liberado utilizando a API do MikroTik RouterOS.

Exemplo de comando:

/ip hotspot active login
user=visitante-xxxxx
mac-address=xx:xx:xx

---

# Componentes do sistema

1. **MikroTik**

   * hotspot
   * portal cativo
   * controle de banda

2. **Backend GestIQ**

   * geração de tokens
   * envio de WhatsApp
   * registro de sessões
   * integração com API MikroTik

3. **Portal Wi-Fi**

   * interface para visitantes
   * captura de número
   * aceite de termos

---

# Termo de uso da rede

O portal deve incluir aviso simples de uso da rede:

Ao acessar esta rede você declara estar ciente de que:

• O acesso é registrado para fins de segurança
• O uso da internet deve respeitar a legislação brasileira
• Atividades ilícitas são de responsabilidade do usuário

---

# Ordem de desenvolvimento do módulo

Para evitar complexidade desnecessária, o desenvolvimento deve seguir a sequência abaixo.

## Fase 1 — Definição

1. Definir fluxo completo de acesso
2. Definir regras de uso
3. Definir limites de tempo e dispositivos
4. Definir comportamento para visitantes sem WhatsApp

---

## Fase 2 — Modelo de dados

Criar as tabelas iniciais:

wifi_visitantes
wifi_tokens
wifi_sessoes
wifi_config

---

## Fase 3 — Integração com MikroTik

Implementar integração básica com a API:

* conectar no MikroTik
* liberar usuário hotspot
* remover acesso
* consultar sessões ativas

Este passo valida a viabilidade técnica do módulo.

---

## Fase 4 — Backend mínimo

Criar rotas básicas:

POST /wifi/solicitar-acesso
POST /wifi/gerar-token
GET /wifi/validar-token
POST /wifi/liberar-acesso

---

## Fase 5 — Portal Wi-Fi

Criar portal mínimo funcional:

* botão hóspede
* botão visitante
* campo WhatsApp
* aceite de termos

Primeiro funcional, depois estético.

---

## Fase 6 — Sistema de tokens

Implementar:

* geração de token único
* expiração automática
* validação de acesso

---

## Fase 7 — Simulação de envio

Antes da integração real com WhatsApp:

* gerar token
* retornar link de acesso
* testar fluxo completo

---

## Fase 8 — Integração WhatsApp

Integrar envio real da mensagem contendo o link de acesso.

---

## Fase 9 — Registro de sessões

Registrar no banco:

telefone
MAC
IP
inicio
fim
token
tipo

---

## Fase 10 — Fallback sem WhatsApp

Adicionar fluxo alternativo:

* voucher manual
* liberação pela recepção

---

## Fase 11 — Painel administrativo

Criar dashboard para:

* visualizar sessões
* bloquear acessos
* configurar limites
* visualizar estatísticas

---

## Fase 12 — Integração com hóspedes

Integração futura com sistema do hotel:

* check-in libera Wi-Fi
* checkout encerra acesso

---

# Dashboard futuro

O módulo poderá fornecer estatísticas como:

visitantes hoje
novos contatos
tempo médio de permanência
pico de uso

---

# Evolução futura

Possibilidades de expansão:

* Wi-Fi marketing
* analytics de presença
* detecção de visitantes recorrentes
* integração com SafeCheckin
* campanhas automatizadas

---

# Potencial de produto

Este módulo pode evoluir para produto comercial:

GestIQ WiFiConnect

Possível modelo SaaS para:

* hotéis
* pousadas
* bares
* restaurantes
* clínicas
* academias
* coworkings

---

# Status do projeto

📌 **Fase atual:** conceito e arquitetura inicial

Próximos passos imediatos:

1. definir modelo de dados
2. criar integração básica com MikroTik
3. criar geração de token
4. criar portal mínimo
5. testar fluxo completo

---

# Arquitetura do GestIQ

GestIQ

mod-scraper
mod-tarifario
mod-wificonnect

---

# Nota

Este README serve como **documentação base e ponto de retomada do desenvolvimento do módulo WiFiConnect dentro do GestIQ.**