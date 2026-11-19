import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Automatisch erkennen, ob Docker oder lokal
const isDocker = process.env.DOCKER === 'true';
const backendTarget = isDocker ? 'http://backend:5000' : 'http://localhost:5000';

const dockerStartupUrl = {
  name: 'docker-startup-url',
  apply: 'serve',
  configureServer(server) {
    // Compose publishes Vite's internal port 5173 on the host's port 8503.
    server.printUrls = () => {
      server.config.logger.info('  ➜  Local:   http://localhost:8503/');
    };
  },
};

// ---- Vite Config ----
export default defineConfig({
  plugins: [react(), isDocker && dockerStartupUrl],
  server: {
    port: 5173,
    proxy: {
      '/preview': backendTarget,
      '/upload': backendTarget,
      '/status': backendTarget,
      '/original': backendTarget,
      '/datagraphs': backendTarget,
      '/inference': backendTarget,
      '/imputation': backendTarget,
      '/anomaly': backendTarget,
      '/personal': backendTarget,
      '/tasktype': backendTarget,
      '/metadata': backendTarget,
      '/summary': backendTarget,
      '/detectedCounts': backendTarget,
      '/model': backendTarget,
      '/cleaned': backendTarget,
      '/downloadZip': backendTarget,
      '/reset': backendTarget
    }
  }
});
