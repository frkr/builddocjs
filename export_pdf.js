#!/usr/bin/env node
/**
 * Script para exportar documentos Markdown para PDF formatado profissionalmente.
 * 
 * Este script converte todos os arquivos .md da raiz do projeto em PDFs
 * formatados com numeração, índices e formatação profissional.
 * Suporta renderização de diagramas Mermaid.js usando Chrome headless (Puppeteer).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const puppeteer = require('puppeteer');
const marked = require('marked');

// Configuração de estilo CSS para PDF profissional
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
function createHtmlTemplate(markdownContent) {
    // Configurar marked
    marked.setOptions({
        breaks: true,
        gfm: true
    });
    
    // Converter Markdown para HTML
    let htmlContent = marked.parse(markdownContent);
    
    // Transformar blocos de código mermaid em divs com classe mermaid
    // O marked converte ```mermaid em <pre><code class="language-mermaid">
    // Precisamos converter para <div class="mermaid">
    htmlContent = htmlContent.replace(
        /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
        '<div class="mermaid">$1</div>'
    );

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documento PDF</title>
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
        } catch (_) {
            // ignore
        }
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

/**
 * Exporta um arquivo Markdown para PDF usando Puppeteer
 */
async function exportMarkdownToPdf(mdFile, outputDir, browser) {
    try {
        const filename = path.basename(mdFile, '.md');
        console.log(`  Processando: ${filename}.md`);
        
        // Ler conteúdo do arquivo Markdown
        const markdownContent = fs.readFileSync(mdFile, 'utf8');
        
        // Criar HTML completo
        const htmlContent = createHtmlTemplate(markdownContent);

        // Preferir o modo “builddoc” (Chrome CLI) para evitar falhas do Puppeteer no macOS.
        const chromePath = resolveChromeExecutablePath();
        if (!chromePath) {
            throw new Error(
                'Chrome/Chromium não encontrado. Instale o Google Chrome (ou defina CHROME_PATH/PUPPETEER_EXECUTABLE_PATH).'
            );
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pydoc-export-'));
        const tempHtmlPath = path.join(tempDir, `${filename}.html`);
        fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

        const outputPath = path.join(outputDir, `${filename}.pdf`);
        await runChromePrintToPdf({
            chromePath,
            htmlFilePath: tempHtmlPath,
            pdfOutputPath: outputPath
        });

        // best-effort cleanup
        try {
            fs.unlinkSync(tempHtmlPath);
            fs.rmdirSync(tempDir);
        } catch (_) {
            // ignore
        }
        
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
function displayFileList(files) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Arquivos que serão processados:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    files.forEach((file, index) => {
        const filename = path.basename(file, '.md');
        console.log(`  ${index + 1}. ${path.basename(file)} → ${filename}.pdf`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
}

/**
 * Executa o script kill_chrome.sh
 */
function executeKillChrome(projectRoot) {
    return new Promise((resolve) => {
        const killChromePath = path.join(projectRoot, 'kill_chrome.sh');
        
        if (!fs.existsSync(killChromePath)) {
            console.log('  ⚠️  Script kill_chrome.sh não encontrado. Pulando...');
            resolve();
            return;
        }
        
        console.log('\n  Encerrando processos do Chrome...');
        
        exec(`bash "${killChromePath}"`, (error, stdout, stderr) => {
            if (error) {
                console.log(`  ⚠️  Erro ao executar kill_chrome.sh: ${error.message}`);
            } else {
                if (stdout) {
                    console.log(stdout);
                }
            }
            resolve();
        });
    });
}

/**
 * Função principal
 */
async function main() {
    const projectRoot = __dirname;
    const outputDir = path.join(projectRoot, 'pdf_output');
    
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
    
    // Exibir lista de arquivos que serão processados
    displayFileList(files);
    
    console.log(`Total: ${files.length} arquivo(s) Markdown encontrado(s).`);
    console.log(`Diretório de saída: ${outputDir}\n`);
    
    // Modo de exportação: Chrome headless via CLI (estilo builddoc)
    console.log('Iniciando Chrome headless...');
    const browser = null;
    
    try {
        // Processar cada arquivo sequencialmente
        let successCount = 0;
        let errorCount = 0;
        
        for (const mdFile of files) {
            try {
                await exportMarkdownToPdf(mdFile, outputDir, browser);
                successCount++;
            } catch (error) {
                errorCount++;
                // Erro já foi logado na função
            }
        }
        
        // Fechar navegador (se aplicável)
        if (browser && typeof browser.close === 'function') {
            await browser.close();
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
        console.log(`  PDFs salvos em: ${outputDir}`);
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Executar kill_chrome.sh
        await executeKillChrome(projectRoot);
        
    } catch (error) {
        // Garantir que o navegador seja fechado mesmo em caso de erro (se aplicável)
        if (browser && typeof browser.close === 'function') {
            await browser.close().catch(() => {});
        }
        throw error;
    }
}

// Executar
if (require.main === module) {
    main().catch(error => {
        console.error('\n✗ Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = { exportMarkdownToPdf, main, listMarkdownFiles, displayFileList };
