import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Puedes cambiar el puerto si el 3000 ya está en uso
    proxy: {
      '/api': { // Todas las peticiones que empiecen con /api serán redirigidas
        target: 'http://localhost:5000', // El puerto donde se ejecuta tu backend Flask
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ''), // Si no quieres que /api se envíe al backend
      },
    },
  },
})