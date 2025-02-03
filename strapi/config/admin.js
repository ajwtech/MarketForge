module.exports = ({ env }) => ({
  // ...existing code...
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  // ...existing code...
});
