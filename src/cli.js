#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadConfig, resolveChromiumPath } = require('./config');
const { preflight } = require('./discovery');
const { runBatch } = require('./pipeline/batch');
const { ChromiumEngine } = require('./engines/chromium');
const { BuildDocError, ErrorCodes, usageError } = require('./errors');

const HELP = `
BuildDocJS — converte Markdown da raiz em HTML e PDF A4.

Uso:
  builddocjs [opções]

Opções:
  --root <dir>            Diretório raiz (padrão: cwd)
  --chromium-path <path>  Caminho do executável Chromium
  --output-dir <dir>      Diretório de saída (padrão: build)
  --timeout-ms <n>        Timeout por documento em ms (padrão: 30000)
  --hard-timeout-ms <n>   Timeout global do lote em ms (0 = automático)
  --check                 Apenas preflight (discovery + browser), sem renderizar
  --html-only             Gera apenas HTML (sem PDF/browser)
  --help                  Mostra esta ajuda
  --version               Mostra a versão

Variáveis de ambiente:
  BUILDDOC_CHROMIUM_PATH  Caminho do Chromium (precedência: CLI > env > config)
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--root': args.root = argv[++i]; break;
      case '--chromium-path': args.chromiumPath = argv[++i]; break;
      case '--output-dir': args.outputDir = argv[++i]; break;
      case '--timeout-ms': args.timeoutMs = Number(argv[++i]); break;
      case '--hard-timeout-ms': args.hardTimeoutMs = Number(argv[++i]); break;
      case '--check': args.check = true; break;
      case '--html-only': args.htmlOnly = true; break;
      case '--help': args.help = true; break;
      case '--version': args.version = true; break;
      default:
        if (a.startsWith('-')) throw usageError(`Opção desconhecida: ${a}`);
        args._.push(a);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log(require('../package.json').version);
    return 0;
  }

  const cfg = loadConfig({
    root: args.root ? path.resolve(args.root) : process.cwd(),
    outputDir: args.outputDir || 'build',
    chromiumPath: resolveChromiumPath(
      { chromiumPath: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
      process.env,
      args.chromiumPath
    ),
    ...(Number.isFinite(args.timeoutMs) && args.timeoutMs > 0 ? { timeoutMs: args.timeoutMs } : {}),
    ...(Number.isFinite(args.hardTimeoutMs) && args.hardTimeoutMs >= 0
      ? { hardTimeoutMs: args.hardTimeoutMs }
      : {}),
  });

  // Preflight sem renderização.
  const { files } = preflight(cfg.root, { denylist: cfg.denylist });
  console.log(`Discovery: ${files.length} documento(s) elegível(is).`);
  for (const f of files) console.log(`  - ${path.basename(f)}`);

  if (args.check) {
    const engine = new ChromiumEngine(cfg);
    engine.probe();
    console.log('Preflight OK (browser validado).');
    return 0;
  }

  if (args.htmlOnly) {
    // HTML-only: sem browser.
    const { buildDocumentHtml } = require('./pipeline/batch');
    const fs = require('fs');
    for (const f of files) {
      const html = buildDocumentHtml(f, cfg);
      const name = path.basename(f, '.md');
      const dest = path.join(cfg.root, cfg.outputDir, cfg.htmlDir, `${name}.html`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, html, 'utf8');
      console.log(`  ✓ HTML: ${name}.html`);
    }
    return 0;
  }

  const manifest = await runBatch(cfg);
  console.log(`\nResumo: ${manifest.summary.ok}/${manifest.summary.total} documentos OK.`);
  console.log(`Manifest: ${path.join(cfg.root, cfg.outputDir, 'manifest.json')}`);
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      if (err instanceof BuildDocError) {
        console.error(`Erro [${err.code}]: ${err.message}`);
        process.exit(err.code);
      }
      console.error(`Erro: ${err.message}`);
      process.exit(ErrorCodes.INTERNAL);
    });
}

module.exports = { main, parseArgs };
