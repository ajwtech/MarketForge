export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', false),
  },
  preview: {
    // The base URL of your front-end app
    url: env('CLIENT_URL'),
    // If you’re using Next.js preview mode, include this secret
    query: {
      secret: env('PREVIEW_SECRET'),
    },
  },
});
