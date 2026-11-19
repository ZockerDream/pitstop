// Bündelt den Server (main + cli) mit esbuild nach dist/server und kopiert die SQL-Migrationen dazu.
// node_modules bleiben extern und werden im Image als Produktionsabhängigkeiten mitgeliefert.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist/server', { recursive: true, force: true });
mkdirSync('dist/server', { recursive: true });

await build({
  entryPoints: { main: 'src/server/main.ts', cli: 'src/server/cli.ts' },
  outdir: 'dist/server',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

cpSync('src/server/db/migrations', 'dist/server/migrations', { recursive: true });
console.log('Migrationen nach dist/server/migrations kopiert.');
