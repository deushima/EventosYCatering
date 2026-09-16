import { rm } from 'node:fs/promises';

const generatedFiles = [
  '../dist/.nojekyll',
  '../dist/index.html',
  '../dist/menu.json',
  '../dist/app.css',
  '../dist/app.js'
];

await Promise.all(
  generatedFiles.map((path) => rm(new URL(path, import.meta.url), { force: true }))
);
