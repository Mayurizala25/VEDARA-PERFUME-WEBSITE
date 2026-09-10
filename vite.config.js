import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The storefront entry no longer bundles jsPDF (loaded on demand), so the
    // remaining warning is just the framework + Supabase vendor chunk.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';
          return undefined;
        },
      },
    },
  },
});
