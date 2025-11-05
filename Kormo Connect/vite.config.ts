import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'

export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize for smaller bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    // Enable tree shaking for better optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-radix': ['@radix-ui/react-progress', '@radix-ui/react-toast'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['class-variance-authority', 'clsx', 'tailwind-merge'],
        },
        // Optimize chunk names
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
      // External dependencies for smaller bundle (if using CDN)
      external: [],
    },
    // Optimize CSS
    cssCodeSplit: true,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Compress more aggressively
    cssMinify: 'lightningcss',
  },
  // Optimize dev server
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
    exclude: ['@vite/client', '@vite/env'],
  },
  // Enable compression
  esbuild: {
    // Remove debugger statements
    drop: isProd ? ['console', 'debugger'] : [],
    // Use shorter variable names in production
    minifyIdentifiers: isProd,
    minifySyntax: isProd,
    minifyWhitespace: isProd,
  },
})

