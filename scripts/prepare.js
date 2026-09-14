/* eslint-disable @typescript-eslint/no-var-requires */
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

// Production-safe prepare script:
// - In Docker production installs (pnpm --prod), husky is not installed -> no-op
// - In CI or when HUSKY=0 -> no-op
// - In local dev installs, husky exists -> run `husky install`

if (process.env.HUSKY === '0' || process.env.HUSKY === 'false') {
  process.exit(0);
}

// Many CIs set CI=true; don't block installs on git/husky in CI
if (process.env.CI === 'true' || process.env.CI === '1') {
  process.exit(0);
}

const binDir = path.join(process.cwd(), 'node_modules', '.bin');
const huskyBin =
  process.platform === 'win32' ? path.join(binDir, 'husky.cmd') : path.join(binDir, 'husky');

if (!existsSync(huskyBin)) {
  process.exit(0);
}

const result = spawnSync(huskyBin, ['install'], { stdio: 'inherit' });

// Never fail the install because of git/husky issues
process.exit(result.status === 0 || result.status === null ? 0 : 0);
