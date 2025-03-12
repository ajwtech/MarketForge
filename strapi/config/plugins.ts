export default () => ({
  upload: {
    config: {
      provider: 'strapi-provider-upload-azure-storage',
      providerOptions: {
        authType: 'default',
        account: process.env.STORAGE_ACCOUNT_NAME,
        accountKey: process.env.STORAGE_ACCOUNT_KEY,
        containerName: 'assets',
        defaultPath: 'assets',
      },
    },
  },
});
