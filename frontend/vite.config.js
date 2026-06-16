import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // For client-side routing: serve index.html for all 404s
        historyApiFallback: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5174',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    preview: {
        historyApiFallback: true,
    },
});
