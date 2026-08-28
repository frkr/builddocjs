# BuildDocJS

Converte documentos Markdown da raiz do projeto em **HTML** e **PDF A4**
profissionais, com diagramas Mermaid, destaque de código, tabelas e links
clicáveis.

## Requisitos

- **Node.js 24** (use `nvm use 24` na raiz do repositório).
- **Chromium** instalado pelo Homebrew:

```sh
brew install --cask chromium
```

O aplicativo usa o Chromium instalado pelo Homebrew. Ele não baixa nem instala
navegador por conta própria.

## Como usar

Instale as dependências:

```sh
npm ci
```

Gere os PDFs de todos os documentos Markdown da raiz:

```sh
npm run build:pdf
```

Gere apenas os HTMLs (sem precisar do Chromium):

```sh
npm run build:html
```

Os arquivos gerados ficam em `build/` (HTML em `build/html/`, PDFs em
`build/pdf/`), junto com um `manifest.json` com o resumo do processamento.

## O que é gerado

- PDF A4 com margens de 1,5 cm, texto pesquisável e links clicáveis.
- Diagramas Mermaid renderizados.
- Código com destaque de sintaxe.
- Tabelas, imagens e blocos de terminal formatados.

## Documentos excluídos

`README.md`, `AGENTS.md` e `ARCHITECTURE_PLAN.md` são sempre ignorados na
geração automática.

## Privacidade

O conteúdo dos seus documentos não sai da sua máquina. Apenas as bibliotecas
Mermaid e highlight.js são carregadas de CDN para renderização.

## Licença

Consulte `LICENSE`.
