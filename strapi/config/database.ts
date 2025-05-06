import path from 'path';

export default ({ env }) => {
  const client = env('DATABASE_CLIENT', 'mysql');

  // Pick up the “local” host/port for your SSH tunnel if defined,
  // otherwise keep using your original DATABASE_HOST/PORT.
  const host = env('DB_LOCAL_HOST', env('DATABASE_HOST', 'localhost'));
  const port = env.int('DB_LOCAL_PORT', env.int('DATABASE_PORT', 3306));

  const connections = {
    mysql: {
      connection: {
        host,
        port,
        database: env('DATABASE_NAME', 'strapi'),
        user:     env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false) && {
          key:                    env('DATABASE_SSL_KEY', undefined),
          cert:                   env('DATABASE_SSL_CERT', undefined),
          ca:                     env('DATABASE_SSL_CA', undefined),
          capath:                 env('DATABASE_SSL_CAPATH', undefined),
          cipher:                 env('DATABASE_SSL_CIPHER', undefined),
          rejectUnauthorized:     env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
        idleTimeoutMillis: env.int('DATABASE_IDLE_TIMEOUT', 5 * 60 * 1000),
      },
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
    // … you can add postgres/etc here if you ever switch …
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
