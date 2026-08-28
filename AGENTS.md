# Governança do repositório

Estas regras se aplicam a agentes automatizados e a contribuições humanas.

## Runtime e navegador

- Margem de 1,5 cm do pdf
- o README.md, quando toda a arquitetura e desenvolvimento acabar, deverá conter somente informacoes para o usuario final de forma clara e curta. Sem detalhes tecnicos. O unico detalhe que deve ser usado o `brew` para instalar o Chromium.
- Quando o desenvolvimento acabar, é possivel deletar o diretorio `docs` e `spikes`?
- O runtime alvo é **Node.js 24**. Mudanças futuras de dependências devem manter
  um `package-lock.json` reproduzível e auditado.
- Antes de qualquer comando `node` ou `npm`, carregue o nvm no shell e execute
  obrigatoriamente `nvm use 24` na raiz do repositório. Confirme na mesma sessão
  com `node --version` (deve começar com `v24.`) e `npm --version`. Se o Node.js
  24 não estiver disponível, registre o bloqueio; não instale outra versão como
  parte da tarefa em curso.
- A única engine de navegador aprovada conceitualmente é o **Chromium instalado
  externamente pelo Homebrew no macOS**.
- Instalar, reinstalar, atualizar, reparar, remover quarentena ou desinstalar o
  Chromium é responsabilidade exclusiva do usuário, fora do aplicativo e deste
  repositório. Aplicativo, npm, dependências, hooks, scripts e agentes nunca
  automatizam essas operações.
- A integração futura deve usar exclusivamente `puppeteer-core`, com caminho de
  executável explícito e validado.
- É proibido usar `puppeteer`, baixar ou instalar browsers pelo npm, por hooks de
  lifecycle, por dependências, pelo aplicativo ou por ferramentas auxiliares.
- É proibido detectar ou usar Google Chrome ou Microsoft Edge como fallback. A
  ausência ou incompatibilidade do Chromium externo deve produzir erro claro.
- Agentes não devem instalar, reinstalar, atualizar nem executar Chromium sem
  autorização específica para o workstream de gate.
- A existência ou versão informada pelo usuário não substitui evidências de cask,
  path, executabilidade, arquitetura, integridade e provenance. Falha em qualquer
  pré-condição mantém o gate bloqueado; Chrome e Edge nunca são alternativas.

## Gate antes do produto

- O gate Chromium sintético descrito em `ARCHITECTURE_PLAN.md` é bloqueante.
- Nenhum código produtivo, adapter, dependência de browser ou migração do pipeline
  deve começar antes de uma decisão formal `GO` registrada com evidências.
- Até o gate passar, documentação deve distinguir arquitetura planejada de
  comportamento implementado. Não alegar suporte, compatibilidade ou validação.

## Processos e scripts de emergência

- O aplicativo e scripts npm devem encerrar somente o PID e a árvore de processos
  que tiverem iniciado; nunca devem matar processos por nome.
- `kill_chrome.sh` e `kill_chrome.bat` são ferramentas exclusivamente
  **manuais/emergenciais**. Nunca podem ser chamadas pelo aplicativo, por hooks ou
  por scripts npm.
- Seu uso exige operador humano, PID raiz explícito, revisão do alvo e confirmação
  interativa. Testes só podem ocorrer sob plano específico, com processos
  controlados e autorização humana.

## Escopo atual

O estado vigente é de higiene e governança concluídas. A revalidação de
28/08/2026 confirmou caminho, executabilidade, arquitetura arm64 e versão
154.0.8031.0 do Chromium externo, mas a assinatura estrita e o Gatekeeper
rejeitaram o bundle; a CLI Homebrew não foi revalidada e o launch headless foi
omitido por segurança. O gate permanece bloqueado e não executado.
`ARCHITECTURE_PLAN.md` permanece a fonte de verdade para requisitos, sequência e
critérios de aceite.
