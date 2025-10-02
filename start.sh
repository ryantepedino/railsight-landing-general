#!/bin/bash
echo "🚀 Limpando cache antigo e subindo RailSight..."

# Mata qualquer processo vite/node rodando
pkill -f vite
pkill -f node

# Remove cache de build antigo
rm -rf node_modules/.vite dist

# Sobe o servidor na porta 5175
npm run dev -- --port 5175
