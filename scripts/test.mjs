import { execSync } from 'node:child_process';

try {
  execSync('pnpm -r --if-present --filter=!articket-platform test --reporter=default', {
    stdio: 'inherit'
  });
} catch {
  process.exitCode = 1;
}
