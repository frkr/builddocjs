#!/bin/bash
# Script para matar todos os processos do Chrome/Chromium
# 
# Uso: ./kill_chrome.sh
# 
# Este script mata todos os processos relacionados ao Chrome e Chromium,
# incluindo processos auxiliares e renderizadores.

echo "Encerrando processos do Chrome/Chromium..."

# Matar processos do Google Chrome
if pgrep -x "Google Chrome" > /dev/null; then
    echo "  - Encerrando Google Chrome..."
    pkill -9 "Google Chrome"
    pkill -9 "Google Chrome Helper"
    pkill -9 "Google Chrome Helper (Renderer)"
    pkill -9 "Google Chrome Helper (GPU)"
fi

# Matar processos do Chromium
if pgrep -x "Chromium" > /dev/null; then
    echo "  - Encerrando Chromium..."
    pkill -9 "Chromium"
    pkill -9 "Chromium Helper"
    pkill -9 "Chromium Helper (Renderer)"
    pkill -9 "Chromium Helper (GPU)"
fi

# Matar processos do Chrome de forma genérica (para diferentes sistemas)
if pgrep -i chrome > /dev/null; then
    echo "  - Encerrando processos Chrome restantes..."
    pkill -9 -i chrome
fi

# Verificar se ainda há processos
if pgrep -i chrome > /dev/null; then
    echo "  ⚠️  Ainda há processos Chrome em execução. Tentando forçar encerramento..."
    killall -9 -i chrome 2>/dev/null || true
else
    echo "  ✓ Todos os processos Chrome foram encerrados."
fi

echo "Concluído!"

