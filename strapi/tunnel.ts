// strapi/tunnel.ts
// import 'dotenv/config';
import {
  createTunnel,
  TunnelOptions,
  ServerOptions,
  SshOptions,
  ForwardOptions,
} from 'tunnel-ssh';

export default function openSshTunnel(): Promise<void> {
  if (process.env.USE_SSH_TUNNEL !== 'true') {
    console.log('🔌 SSH tunnel disabled');
    return Promise.resolve();
  }

  // 1) How the tunnel itself behaves:
  const tunnelOptions: TunnelOptions = {
    autoClose: false,          // don’t shut down when the first client disconnects
    reconnectOnError: true,    // if the SSH channel dies, restart it
  };

  // 2) The local TCP server that listens on your machine:
  const serverOptions: ServerOptions = {
    host: process.env.DB_LOCAL_HOST,      // e.g. "127.0.0.1"
    port: Number(process.env.DB_LOCAL_PORT), // e.g. 33306
  };

  // 3) How to SSH into your jumpbox:
  const sshOptions: SshOptions = {
    host:     process.env.SSH_TUNNEL_HOST,   // jumpbox host
    port:     Number(process.env.SSH_TUNNEL_PORT),
    username: process.env.SSH_TUNNEL_USER,
    password: process.env.SSH_TUNNEL_PASSWORD, 
    // –or–
    // privateKey: readFileSync(process.env.SSH_TUNNEL_PRIVATE_KEY_PATH!), // if this is uncommented then you must import fs
    // by adding `import { readFileSync } from 'fs';` to the top of this file
  };

  // 4) Where to forward that local server’s traffic:
  const forwardOptions: ForwardOptions = {
    srcAddr: process.env.DB_LOCAL_HOST,       // optional (defaults to serverOptions.host)
    srcPort: Number(process.env.DB_LOCAL_PORT),
    dstAddr: process.env.DB_REMOTE_HOST,      // e.g. "scoutendbserver.mysql.database.azure.com"
    dstPort: Number(process.env.DB_REMOTE_PORT), // 3306
  };

  console.log(
    `🔌 Tunneling ${serverOptions.host}:${serverOptions.port} → ` +
    `${forwardOptions.dstAddr}:${forwardOptions.dstPort} via SSH`
  );
  console.time('tunnel-establish');

  return createTunnel(
    tunnelOptions,
    serverOptions,
    sshOptions,
    forwardOptions
  )
    .then(([server, client]) => {
      console.timeEnd('tunnel-establish');
      console.log('✅ SSH tunnel established');
    })
    .catch(err => {
      console.error('❌ SSH tunnel error:', err);
      throw err;
    });
}
