// Builds Storybook and saves PNG screenshots of chosen stories, in light and dark, for PR descriptions.
//
//   pnpm screenshots --list                      list story ids
//   pnpm screenshots pages-dashboard             every story whose id starts with this
//   pnpm screenshots pages-dashboard--sankey --scheme dark --out /tmp/shots
//   pnpm screenshots all --no-build              every story, reusing the last build
//
// Uses the Chromium that is already installed (set CHROMIUM_PATH if it is somewhere else); it never
// downloads a browser.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BUILD_DIR = join(ROOT, 'storybook-static');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

function parseArgs(argv) {
  const options = {
    filters: [],
    scheme: 'both',
    out: join(ROOT, 'screenshots'),
    width: 1280,
    height: 800,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') options.list = true;
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--scheme') options.scheme = argv[++i];
    else if (arg === '--out') options.out = resolve(argv[++i]);
    else if (arg === '--width') options.width = Number(argv[++i]);
    else if (arg === '--height') options.height = Number(argv[++i]);
    else options.filters.push(arg);
  }
  if (!['light', 'dark', 'both'].includes(options.scheme))
    throw new Error('--scheme must be light, dark or both');
  return options;
}

function serve(dir) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(dir, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(dir) || !existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

const options = parseArgs(process.argv.slice(2));
if (options.build !== false || !existsSync(BUILD_DIR)) {
  execFileSync('pnpm', ['exec', 'storybook', 'build', '-o', BUILD_DIR, '--quiet'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

const index = JSON.parse(readFileSync(join(BUILD_DIR, 'index.json'), 'utf8'));
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');
if (options.list) {
  for (const story of stories) console.log(story.id);
  process.exit(0);
}
if (options.filters.length === 0) {
  console.error('Name the stories to capture (an id or id prefix), or "all". See --list.');
  process.exit(1);
}
const chosen = options.filters.includes('all')
  ? stories
  : stories.filter((story) => options.filters.some((filter) => story.id.startsWith(filter)));
if (chosen.length === 0) {
  console.error(`No stories match ${options.filters.join(', ')}. See --list.`);
  process.exit(1);
}

const chromiumPath =
  process.env.CHROMIUM_PATH ??
  [process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers']
    .flatMap((dir) => (existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)) : []))
    .flatMap((dir) => [
      join(dir, 'chrome-linux', 'chrome'),
      join(dir, 'chrome-linux', 'headless_shell'),
    ])
    .find(existsSync);

const server = await serve(BUILD_DIR);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: chromiumPath });
mkdirSync(options.out, { recursive: true });
const schemes = options.scheme === 'both' ? ['light', 'dark'] : [options.scheme];

try {
  for (const colorScheme of schemes) {
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      colorScheme,
    });
    for (const story of chosen) {
      const page = await context.newPage();
      page.on('pageerror', (error) => console.warn(`  [${story.id}] ${error.message}`));
      await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`);
      // Storybook adds this class when a story failed to render.
      await page.waitForSelector('body.sb-show-main:not(.sb-show-errordisplay)', {
        timeout: 30_000,
      });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400); // charts and the play function settle
      const file = join(options.out, `${story.id}.${colorScheme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
