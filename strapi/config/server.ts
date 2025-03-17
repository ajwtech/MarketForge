export default ({ env }) => ({
  emitErrors: true,
  url: env('CMS_URL'),
  proxy: true,
  host: env('HOST', '0.0.0.0', 'CMS_URL'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },

});
