import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  // Important: always return the modified config
    const HOSTNAME = process.env.CONTAINER_APP_HOSTNAME || 'localhost';
    const CUSTOM_DOMAIN = process.env.DOMAIN || HOSTNAME;
  
    return mergeConfig(config, {
      server: {
        host: '0.0.0.0',
        allowedHosts: [CUSTOM_DOMAIN, HOSTNAME],
        hmr: {
          clientPort: 443,
          host: CUSTOM_DOMAIN,
          protocol: 'wss',
        },
      },
      // optimizeDeps: {
      //   exclude: [
      //     '@sh/strapi-plugin-ckeditor',
      //     'strapi-plugin-navigation',
      //     '@strapi/plugin-users-permissions',
      //     '@strapi/plugin-seo',
      //   ],
      // },
      resolve: {
        alias: {
          '@': '/src',
        },
      },
    });
};
