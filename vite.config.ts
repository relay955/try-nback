import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/try-nback/',
  plugins: [react()],
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
})
