// // strapi/dev.ts
// import dotenv from 'dotenv';
// import path from 'path';
// // assumes dev.ts lives in strapi/, next to .env.development
// dotenv.config({ path: path.resolve(__dirname, './.env.development') });
import { spawn } from 'child_process';
import openSshTunnel from './tunnel';

async function main(): Promise<void> {
  // 1) Open (or skip) the SSH tunnel
  await openSshTunnel();

  // 2) Hand off to Strapi CLI via Yarn
  const child = spawn('yarn', ['strapi', 'develop'], {
    stdio: 'inherit',
    shell: true, // ensures the command is correctly resolved in all environments
  });

  child.on('exit', (code: number | null) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err: Error) => {
    console.error('⚠️  Failed to launch Strapi CLI:', err);
    process.exit(1);
  });
}

main().catch((err: Error) => {
  console.error('❌  SSH-tunnel bootstrap failed:', err);
  process.exit(1);
});
