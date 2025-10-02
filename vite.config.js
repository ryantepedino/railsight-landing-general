import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,      // aceita conexões externas (ex.: celular na mesma rede)
    port: 5173,      // força sempre usar a porta 5173
    strictPort: true // não pula para outra porta, dá erro se estiver ocupada
  }
})

