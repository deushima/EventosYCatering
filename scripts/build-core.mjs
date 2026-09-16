import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as sass from 'sass';
import { parseMenuSource, renderStaticHtml } from './menu-html.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dist = resolve(root, 'dist');
export const staticDir = resolve(root, 'src/static');
export const stylesEntry = resolve(root, 'src/scss/main.scss');
export const scriptsEntry = resolve(root, 'src/ts/main.ts');
export const menuSource = resolve(root, 'menu.json');
export const staticIndexTemplate = resolve(staticDir, 'index.html');

const ASSET_VERSION_MARKER = '__ASSET_VERSION__';
const stylesOutput = resolve(dist, 'app.css');
const scriptsOutput = resolve(dist, 'app.js');

const toBuffer = (content) => Buffer.isBuffer(content)
  ? content
  : Buffer.from(content);

export async function writeFileIfChanged(path, content) {
  const nextContent = toBuffer(content);

  try {
    const currentContent = await readFile(path);
    if (currentContent.equals(nextContent)) return false;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  await writeFile(path, nextContent);
  return true;
}

async function removeFileIfPresent(path) {
  try {
    await access(path, constants.F_OK);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }

  await rm(path, { force: true });
  return true;
}

export async function assertAssets() {
  await access(resolve(dist, 'assets'), constants.R_OK);
}

export async function readMenuSource() {
  const rawMenu = await readFile(menuSource, 'utf8');
  return parseMenuSource(rawMenu);
}

export async function createAssetVersion() {
  const [styles, scripts] = await Promise.all([
    readFile(stylesOutput),
    readFile(scriptsOutput)
  ]);

  return createHash('sha256')
    .update(styles)
    .update('\0')
    .update(scripts)
    .digest('hex')
    .slice(0, 12);
}

export async function syncStaticFiles(assetVersion) {
  await mkdir(dist, { recursive: true });

  const resolvedAssetVersion = assetVersion ?? await createAssetVersion();
  const [template, menu] = await Promise.all([
    readFile(staticIndexTemplate, 'utf8'),
    readMenuSource()
  ]);

  if (!template.includes(ASSET_VERSION_MARKER)) {
    throw new Error(`Static template must contain ${ASSET_VERSION_MARKER}.`);
  }

  const versionedTemplate = template.replaceAll(ASSET_VERSION_MARKER, resolvedAssetVersion);
  const generatedHtml = renderStaticHtml(versionedTemplate, menu);

  const [htmlChanged, noJekyllChanged, staleMenuRemoved] = await Promise.all([
    writeFileIfChanged(resolve(dist, 'index.html'), generatedHtml),
    writeFileIfChanged(resolve(dist, '.nojekyll'), ''),
    removeFileIfPresent(resolve(dist, 'menu.json'))
  ]);

  return htmlChanged || noJekyllChanged || staleMenuRemoved;
}

export async function compileStyles() {
  const stylesheet = sass.compile(stylesEntry, {
    style: 'expanded',
    loadPaths: [resolve(root, 'src/scss')],
    sourceMap: false
  });

  return writeFileIfChanged(stylesOutput, stylesheet.css);
}

export async function bundleScripts() {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [scriptsEntry],
    outfile: scriptsOutput,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    legalComments: 'none',
    sourcemap: false,
    minify: false,
    logLevel: 'info',
    write: false
  });
  const output = result.outputFiles?.find((file) => file.path.endsWith('app.js'));

  if (!output) {
    throw new Error('esbuild did not produce app.js.');
  }

  return writeFileIfChanged(scriptsOutput, output.contents);
}

export async function buildAll() {
  await mkdir(dist, { recursive: true });
  await assertAssets();

  const [stylesChanged, scriptsChanged] = await Promise.all([
    compileStyles(),
    bundleScripts()
  ]);
  const assetVersion = await createAssetVersion();
  const staticChanged = await syncStaticFiles(assetVersion);

  return {
    staticChanged,
    stylesChanged,
    scriptsChanged,
    anyChanged: staticChanged || stylesChanged || scriptsChanged
  };
}
