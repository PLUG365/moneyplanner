import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, normalize, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const issuesUrl = 'https://github.com/minoru365/moneyplanner/issues';
const pages = [
  'site/index.html',
  'site/privacy/index.html',
  'site/support/index.html',
  'site/404.html',
];
const requiredFiles = [
  ...pages,
  'site/assets/styles.css',
  'site/assets/nanbo-icon.svg',
  'site/assets/favicon.png',
  'site/assets/csv-import.png',
  '.github/workflows/pages.yml',
];

const errors = [];
const fail = (message) => errors.push(message);
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const textOnly = (value) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/[>#*_`\[\]()-]/g, ' ')
  .replace(/\s+/g, '')
  .trim();
const has = (value, snippet) => textOnly(value).includes(textOnly(snippet));

const missing = requiredFiles.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) {
  for (const file of missing) fail(`Missing required artifact: ${file}`);
  console.error(errors.join('\n'));
  process.exit(1);
}

if (!readFileSync(resolve(root, 'site/assets/nanbo-icon.svg')).equals(
  readFileSync(resolve(root, 'assets/images/nanbo-icon.svg')),
)) {
  fail('site/assets/nanbo-icon.svg: must be byte-identical to assets/images/nanbo-icon.svg');
}

function localTargetIsValid(page, url) {
  if (/^(?:https?:|mailto:|tel:|#)/i.test(url)) return true;
  if (url.startsWith('/')) return false;
  const pathname = url.split(/[?#]/, 1)[0];
  if (!pathname) return true;
  const target = resolve(root, dirname(page), pathname);
  const siteRoot = resolve(root, 'site');
  if (!target.startsWith(`${siteRoot}${sep}`) && target !== siteRoot) return false;
  if (existsSync(target)) return true;
  if (!extname(target) && existsSync(resolve(target, 'index.html'))) return true;
  return false;
}

function validatePage(page) {
  const html = read(page);
  const pageErrors = [];
  const add = (message) => pageErrors.push(`${page}: ${message}`);
  if (!/<html\b[^>]*\blang=["']ja["']/i.test(html)) add('html lang must be ja');
  if (!/<meta\b[^>]*charset=["']?utf-8["']?/i.test(html)) add('missing UTF-8 charset');
  if (!/<meta\b[^>]*name=["']viewport["'][^>]*content=["'][^"']+/i.test(html)) add('missing viewport meta');
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) add('title must be nonempty');
  if ((html.match(/<main\b/gi) || []).length !== 1) add('must contain exactly one main');
  if ((html.match(/<h1\b/gi) || []).length !== 1) add('must contain exactly one h1');

  for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(image[1])) add('every img requires alt text');
  }

  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const url = match[1];
    if (url.startsWith('/')) add(`root-relative URL is not allowed: ${url}`);
    if (!localTargetIsValid(page, url)) add(`invalid local relative target: ${url}`);
  }

  const privacyLink = page === 'site/404.html'
    ? 'https://minoru365.github.io/moneyplanner/privacy/'
    : page === 'site/index.html' ? 'privacy/' : '../privacy/';
  const supportLink = page === 'site/404.html'
    ? 'https://minoru365.github.io/moneyplanner/support/'
    : page === 'site/index.html' ? 'support/' : '../support/';
  if (!html.includes(`href="${privacyLink}"`)) add('missing privacy navigation link');
  if (!html.includes(`href="${supportLink}"`)) add('missing support navigation link');
  errors.push(...pageErrors);
  return html;
}

const pageHtml = Object.fromEntries(pages.map((page) => [page, validatePage(page)]));
const home = pageHtml['site/index.html'];
for (const claim of [
  'NANBO - みんなの家計簿', '世帯', 'Apple Sign-In', 'Cloud Firestore',
  'CSVエクスポート', '無料', 'CSVインポート', '¥300', '買い切り',
  'Family Sharingでは共有されません',
]) {
  if (!has(home, claim)) fail(`site/index.html: missing required claim: ${claim}`);
}
if (!/<section\b[^>]*\bid=["']features["']/i.test(home)) fail('site/index.html: missing features section id');
if (!/<a\b[^>]*href=["']#features["']/i.test(home)) fail('site/index.html: missing features header link');
if (!/<section\b[^>]*\bid=["']pricing["']/i.test(home)) fail('site/index.html: missing pricing section id');
if (!/<a\b[^>]*href=["']#pricing["']/i.test(home)) fail('site/index.html: missing pricing header link');
if (!home.includes(`href="${issuesUrl}"`)) fail('site/index.html: missing exact GitHub Issues URL');
if (!home.includes('<span class="title-brand">NANBO</span>')) fail('site/index.html: missing semantic NANBO title fragment');
if (!home.includes('<span class="title-product">みんなの家計簿</span>')) fail('site/index.html: missing semantic product title fragment');

const support = pageHtml['site/support/index.html'];
if (!support.includes(`href="${issuesUrl}"`)) fail('site/support/index.html: missing exact GitHub Issues URL');

const policy = read('docs/privacy-policy.md');
const privacy = pageHtml['site/privacy/index.html'];
if (!privacy.includes('<span class="title-product">NANBO - みんなの家計簿</span>')) fail('site/privacy/index.html: missing semantic product title fragment');
if (!privacy.includes('<span class="title-policy">プライバシーポリシー</span>')) fail('site/privacy/index.html: missing semantic policy title fragment');
const policyFragments = policy.match(/^#{1,2}\s+.+$/gm) || [];
if (policyFragments.length !== 11) fail('docs/privacy-policy.md: expected an H1 and ten section headings');
for (const fragment of policyFragments) {
  if (!has(privacy, fragment)) fail(`site/privacy/index.html: missing policy heading: ${fragment}`);
}
for (const line of policy.split(/\r?\n/).map(textOnly).filter((value) => value.length >= 3)) {
  if (!textOnly(privacy).includes(line)) fail(`site/privacy/index.html: policy content differs from source: ${line.slice(0, 80)}`);
}

const workflow = read('.github/workflows/pages.yml');
const styles = read('site/assets/styles.css');
if (!/a\[href=["']https:\/\/github\.com\/minoru365\/moneyplanner\/issues["']\]\s*\{[^}]*overflow-wrap:\s*anywhere/i.test(styles)) {
  fail('site/assets/styles.css: missing explicit GitHub Issues URL wrap rule');
}
const workflowChecks = [
  ['push master trigger', /push:\s*[\s\S]*?branches:\s*\[\s*master\s*\]/],
  ['workflow_dispatch trigger', /workflow_dispatch:/],
  ['site path trigger', /site\/\*\*/],
  ['validator path trigger', /scripts\/validate-pages\.mjs/],
  ['privacy source path trigger', /docs\/privacy-policy\.md/],
  ['workflow path trigger', /\.github\/workflows\/pages\.yml/],
  ['checkout action', /actions\/checkout@v6/],
  ['setup-node action', /actions\/setup-node@v4/],
  ['Node 22', /node-version:\s*['"]?22['"]?/],
  ['configure-pages action', /actions\/configure-pages@v5/],
  ['upload-pages-artifact action', /actions\/upload-pages-artifact@v4/],
  ['site artifact path', /path:\s*site/],
  ['deploy-pages action', /actions\/deploy-pages@v4/],
  ['contents read permission', /contents:\s*read/],
  ['pages write permission', /pages:\s*write/],
  ['id-token write permission', /id-token:\s*write/],
  ['deploy needs build', /deploy:\s*[\s\S]*?needs:\s*build/],
  ['github-pages environment', /environment:\s*[\s\S]*?name:\s*github-pages/],
  ['deployment URL output', /url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/],
  ['pages concurrency', /concurrency:\s*[\s\S]*?group:\s*['"]?pages/],
  ['non-cancelling concurrency', /cancel-in-progress:\s*false/],
];
for (const [label, expression] of workflowChecks) {
  if (!expression.test(workflow)) fail(`.github/workflows/pages.yml: missing ${label}`);
}
if (!/node\s+scripts\/validate-pages\.mjs/.test(workflow)) fail('.github/workflows/pages.yml: validator is not run');
if (/npm\s+(?:ci|install)|yarn|pnpm/i.test(workflow)) fail('.github/workflows/pages.yml: dependency installation is not allowed');

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('GitHub Pages static site validation passed.');
