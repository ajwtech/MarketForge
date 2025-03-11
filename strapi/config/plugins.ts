export default () => ({
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        accessKeyId: process.env.STORAGE_ACCOUNT_NAME,
        secretAccessKey: process.env.STORAGE_ACCOUNT_KEY,
        region: 'us-east-1', // Required by AWS SDK but not used by Azure
        endpoint: `https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        s3ForcePathStyle: true, 
        signatureVersion: 'v4', // Add signature version for compatibility
        params: {
          Bucket: 'assets',
          ACL: 'public-read',
        },
      },
      actionOptions: {
        upload: {
          ACL: 'public-read' // Ensure uploads are publicly readable
        },
        uploadStream: {
          ACL: 'public-read'
        },
        delete: {},
      },
      breakpoints: {
        xlarge: 1920,
        large: 1000,
        medium: 750,
        small: 500,
        xsmall: 64
      },
    },
  },
});
