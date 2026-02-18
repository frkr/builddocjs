#!/bin/bash
# Script para matar todos os processos do Chrome/Chromium
# 
# Uso: ./kill_chrome.sh
# 
# Este script mata todos os processos relacionados ao Chrome e Chromium,
# incluindo processos auxiliares e renderizadores.

echo "Encerrando processos do Chrome/Chromium..."

# Matar processos do Google Chrome
if pgrep -fi "Google Chrome" > /dev/null || pgrep -fi "chrome" > /dev/null; then
    echo "  - Encerrando Google Chrome..."
    pkill -9 -fi "Google Chrome" 2>/dev/null
    pkill -9 -fi "chrome" 2>/dev/null
fi

# Matar processos do Chromium
if pgrep -fi "Chromium" > /dev/null || pgrep -fi "chromium" > /dev/null; then
    echo "  - Encerrando Chromium..."
    pkill -9 -fi "Chromium" 2>/dev/null
    pkill -9 -fi "chromium" 2>/dev/null
fi

# Verificar se ainda há processos
if pgrep -fi chrome > /dev/null || pgrep -fi chromium > /dev/null; then
    echo "  ⚠️  Ainda há processos Chrome/Chromium em execução. Tentando forçar encerramento..."
    pkill -9 -fi chrome 2>/dev/null
    pkill -9 -fi chromium 2>/dev/null
    killall -9 "Google Chrome" 2>/dev/null
    killall -9 "Chromium" 2>/dev/null
else
    echo "  ✓ Todos os processos Chrome foram encerrados."
fi

echo "Concluído!"

