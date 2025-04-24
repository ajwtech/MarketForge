console.log("[vite.config.ts] loaded")
import { mergeConfig, searchForWorkspaceRoot, type UserConfig } from 'vite';
import dns from 'dns';

dns.setDefaultResultOrder('verbatim');

export default (config: UserConfig) => {
  const HOSTNAME = process.env.CONTAINER_APP_HOSTNAME || 'localhost';

  return mergeConfig(config, {
    server: {
      host: '0.0.0.0',
      port: 1337,
      strictPort: true,
      allowedHosts: true,
      fs: {
        strict: false,
        allow: ['/', '/opt/app', '/opt/node_modules'], 
      },
      hmr: {
        port: 5173,            // Same unified HTTP/WebSocket port
        protocol: 'wss',       // Enforced by ACA SSL
        clientPort: 443,       // ACA HTTPS standard port
        path: '/ws/',
      },
    },
    optimizeDeps: {
      exclude: process.env.NODE_ENV === 'development' ? [] : [
        '@sh/strapi-plugin-ckeditor',
        'strapi-plugin-navigation',
        '@strapi/plugin-users-permissions',
        '@strapi/plugin-seo',
      ],
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  });
};
