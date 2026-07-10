#!/usr/bin/env node
/*
MIT License

Copyright (c) Davi Saranszky Mesquita

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
 */
/**
 * Script para exportar documentos Markdown para HTML e/ou PDF formatado.
 *
 * Converte todos os arquivos .md da raiz do projeto em HTMLs com CSS profissional
 * e suporte a diagramas Mermaid.js. Opcionalmente exporta para PDF via Chrome headless.
 *
 * Uso:
 *   node export_pdf.js              # exporta PDFs (padrão, requer Chrome)
 *   node export_pdf.js --html       # exporta apenas os HTMLs (sem precisar do Chrome)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const marked = require('marked');

// Configuração de estilo CSS para HTML/PDF profissional
const PDF_CSS = `
@page {
    size: A4;
    margin: 2.5cm 2cm;
}

body {
    font-family: 'DejaVu Sans', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
    padding: 0;
    max-width: 100%;
}

h1 {
    font-size: 24pt;
    color: #1a1a1a;
    margin-top: 30pt;
    margin-bottom: 15pt;
    page-break-after: avoid;
    border-bottom: 2px solid #333;
    padding-bottom: 10pt;
}

h2 {
    font-size: 18pt;
    color: #2a2a2a;
    margin-top: 25pt;
    margin-bottom: 12pt;
    page-break-after: avoid;
}

h3 {
    font-size: 14pt;
    color: #3a3a3a;
    margin-top: 20pt;
    margin-bottom: 10pt;
    page-break-after: avoid;
}

h4 {
    font-size: 12pt;
    color: #4a4a4a;
    margin-top: 15pt;
    margin-bottom: 8pt;
    page-break-after: avoid;
}

p {
    margin-bottom: 10pt;
    text-align: justify;
}

ul, ol {
    margin-bottom: 10pt;
    padding-left: 25pt;
}

li {
    margin-bottom: 5pt;
}

code {
    font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
    font-size: 9pt;
    background-color: #f5f5f5;
    padding: 2pt 4pt;
    border-radius: 3pt;
}

pre {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 5pt;
    padding: 10pt;
    margin: 15pt 0;
    overflow-x: auto;
    page-break-inside: avoid;
}

pre code {
    background-color: transparent;
    padding: 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 15pt 0;
    page-break-inside: avoid;
}

th, td {
    border: 1px solid #ddd;
    padding: 8pt;
    text-align: left;
}

th {
    background-color: #f0f0f0;
    font-weight: bold;
}

blockquote {
    border-left: 4px solid #ddd;
    padding-left: 15pt;
    margin: 15pt 0;
    color: #666;
    font-style: italic;
}

/* Estilos para diagramas Mermaid */
.mermaid {
    text-align: center;
    margin: 20pt 0;
    page-break-inside: avoid;
}

@media print {
    body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
    }
}
`;

/**
 * Cria o template HTML completo com Mermaid.js
 */
function createHtmlTemplate(markdownContent, title) {
    // Configurar marked
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    // Converter Markdown para HTML
    let htmlContent = marked.parse(markdownContent);

    // Transformar blocos de código mermaid em divs com classe mermaid
    htmlContent = htmlContent.replace(
        /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
        '<div class="mermaid">$1</div>'
    );

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        ${PDF_CSS}
    </style>
</head>
<body>
    ${htmlContent}
    <script>
        // Inicializar Mermaid.js
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose'
        });
        
        // Aguardar renderização completa
        (function() {
            let renderedCount = 0;
            const mermaidElements = document.querySelectorAll('.mermaid');
            const totalCount = mermaidElements.length;

            if (totalCount === 0) {
                // Se não houver diagramas Mermaid, sinalizar imediatamente
                window.mermaidReady = true;
                return;
            }
            
            // Aguardar renderização de cada diagrama
            mermaidElements.forEach(function(element, index) {
                // Verificar se o elemento foi renderizado (tem SVG filho)
                const checkRender = setInterval(function() {
                    if (element.querySelector('svg')) {
                        renderedCount++;
                        clearInterval(checkRender);
                        
                        if (renderedCount === totalCount) {
                            // Todos os diagramas foram renderizados
                            setTimeout(function() {
                                window.mermaidReady = true;
                            }, 500);
                        }
                    }
                }, 100);
                
                // Timeout de segurança
                setTimeout(function() {
                    clearInterval(checkRender);
                    renderedCount++;
                    if (renderedCount === totalCount) {
                        window.mermaidReady = true;
                    }
                }, 10000);
            });
        })();
    </script>
</body>
</html>`;
}

/**
 * Converte imagens locais referenciadas no HTML para base64 inline,
 * resolvendo os caminhos relativos a partir do diretório do arquivo .md original.
 */
function inlineLocalImages(htmlContent, mdFileDir) {
    return htmlContent.replace(/<img([^>]*?)src="([^"]*)"([^>]*?)>/gi, (match, before, src, after) => {
        if (/^https?:\/\//i.test(src) || /^data:/i.test(src)) {
            return match;
        }
        try {
            const imgPath = path.isAbsolute(src) ? src : path.join(mdFileDir, src);
            if (!fs.existsSync(imgPath)) return match;
            const imgData = fs.readFileSync(imgPath);
            const ext = path.extname(imgPath).slice(1).toLowerCase();
            const mimeMap = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif', svg: 'svg+xml', webp: 'webp' };
            const mime = `image/${mimeMap[ext] || ext}`;
            const base64 = imgData.toString('base64');
            return `<img${before}src="data:${mime};base64,${base64}"${after}>`;
        } catch (_) {
            return match;
        }
    });
}

/**
 * Gera o HTML a partir de um arquivo Markdown e salva no disco.
 * Retorna o caminho do arquivo HTML gerado.
 */
function generateHtml(mdFile, outputDir) {
    const filename = path.basename(mdFile, '.md');
    const markdownContent = fs.readFileSync(mdFile, 'utf8');

    let htmlContent = createHtmlTemplate(markdownContent, filename);
    const mdFileDir = path.dirname(mdFile);
    htmlContent = inlineLocalImages(htmlContent, mdFileDir);

    const htmlOutputPath = path.join(outputDir, `${filename}.html`);
    fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');

    return htmlOutputPath;
}

// ── Modo PDF (Chrome headless) ──────────────────────────────────────────────

function resolveChromeExecutablePath() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ].filter(Boolean);

    for (const p of candidates) {
        try {
            if (p && fs.existsSync(p)) return p;
        } catch (_) { /* ignore */ }
    }
    return null;
}

function runChromePrintToPdf({ chromePath, htmlFilePath, pdfOutputPath }) {
    return new Promise((resolve, reject) => {
        const fileUrl = `file://${htmlFilePath}`;

        // Modo “builddoc”: usar Chrome headless para imprimir HTML em PDF
        // (referência: https://github.com/frkr/builddoc)
        const args = [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--allow-file-access-from-files',
            '--virtual-time-budget=30000',
            '--print-to-pdf-no-header',
            `--print-to-pdf=${pdfOutputPath}`,
            fileUrl
        ];

        const child = spawn(chromePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(stderr || `Chrome exit code ${code}`));
        });
    });
}

async function exportMarkdownToPdf(mdFile, outputDir) {
    try {
        const filename = path.basename(mdFile, '.md');
        console.log(`  Processando: ${filename}.md`);

        const chromePath = resolveChromeExecutablePath();
        if (!chromePath) {
            throw new Error(
                'Chrome/Chromium não encontrado. Instale o Google Chrome (ou defina CHROME_PATH/PUPPETEER_EXECUTABLE_PATH).'
            );
        }

        // Gera HTML temporário
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builddoc-export-'));
        const tempHtmlPath = path.join(tempDir, `${filename}.html`);
        const markdownContent = fs.readFileSync(mdFile, 'utf8');
        let htmlContent = createHtmlTemplate(markdownContent, filename);
        htmlContent = inlineLocalImages(htmlContent, path.dirname(mdFile));
        fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

        const pdfPath = path.join(outputDir, `${filename}.pdf`);
        await runChromePrintToPdf({ chromePath, htmlFilePath: tempHtmlPath, pdfOutputPath: pdfPath });

        // cleanup
        try { fs.unlinkSync(tempHtmlPath); fs.rmdirSync(tempDir); } catch (_) { /* ignore */ }

        console.log(`    ✓ Gerado: ${filename}.pdf`);
        return true;
    } catch (error) {
        console.error(`    ✗ Erro ao processar ${path.basename(mdFile)}: ${error.message}`);
        throw error;
    }
}

/**
 * Lista todos os arquivos .md da raiz do projeto
 */
function listMarkdownFiles(projectRoot) {
    return fs.readdirSync(projectRoot)
        .filter(file => {
            const filePath = path.join(projectRoot, file);
            return fs.statSync(filePath).isFile() && file.endsWith('.md');
        })
        .map(file => path.join(projectRoot, file))
        .sort();
}

/**
 * Exibe a lista de arquivos que serão processados
 */
function displayFileList(files, outputExt) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Arquivos que serão processados:');
    console.log('═══════════════════════════════════════════════════════════\n');

    files.forEach((file, index) => {
        const filename = path.basename(file, '.md');
        console.log(`  ${index + 1}. ${path.basename(file)} → ${filename}.${outputExt}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════\n');
}

/**
 * Função principal
 */
async function main() {
    const projectRoot = __dirname;

    // Detecta modo --html
    const htmlOnly = process.argv.includes('--html');
    const outputExt = htmlOnly ? 'html' : 'pdf';
    const outputDir = path.join(projectRoot, htmlOnly ? 'html_output' : 'pdf_output');

    // Criar diretório de saída
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Encontrar todos os arquivos .md na raiz
    const files = listMarkdownFiles(projectRoot);

    if (files.length === 0) {
        console.log('Nenhum arquivo Markdown encontrado na raiz do projeto.');
        return;
    }

    displayFileList(files, outputExt);

    console.log(`Total: ${files.length} arquivo(s) Markdown encontrado(s).`);
    console.log(`Diretório de saída: ${outputDir}\n`);

    let successCount = 0;
    let errorCount = 0;

    if (htmlOnly) {
        // ── Modo HTML-only (sem Chrome) ──────────────────────────────────
        console.log('Modo HTML: gerando arquivos HTML...\n');

        for (const mdFile of files) {
            try {
                const filename = path.basename(mdFile, '.md');
                console.log(`  Processando: ${filename}.md`);
                generateHtml(mdFile, outputDir);
                console.log(`    ✓ Gerado: ${filename}.html`);
                successCount++;
            } catch (error) {
                errorCount++;
                console.error(`    ✗ Erro ao processar ${path.basename(mdFile)}: ${error.message}`);
            }
        }
    } else {
        // ── Modo PDF (comportamento original) ────────────────────────────
        console.log('Iniciando Chrome headless...');

        for (const mdFile of files) {
            try {
                await exportMarkdownToPdf(mdFile, outputDir);
                successCount++;
            } catch (error) {
                errorCount++;
            }
        }
    }

    // Exibir resumo
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Resumo do processamento:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  ✓ Sucesso: ${successCount} arquivo(s)`);
    if (errorCount > 0) {
        console.log(`  ✗ Erros: ${errorCount} arquivo(s)`);
    }
    console.log(`  Total: ${files.length} arquivo(s)`);
    console.log(`  Saída em: ${outputDir}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

// Executar
if (require.main === module) {
    main().catch(error => {
        console.error('\n✗ Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = { generateHtml, exportMarkdownToPdf, main, listMarkdownFiles };
