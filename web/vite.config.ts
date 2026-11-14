import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the build works on GitHub Pages or any static host sub-path
export default defineConfig({ plugins: [react()], base: './' })
