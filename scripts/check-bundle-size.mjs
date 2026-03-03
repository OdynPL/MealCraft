import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve('dist/mealcraft/browser');
const REPORT_DIR = path.resolve('reports/bundle-size');
const MAX_KB = Number(process.env.BUNDLE_MAX_KB ?? '1400');
const MAX_BYTES = Math.round(MAX_KB * 1024);

async function listFilesRecursively(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursively(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function toKb(value) {
  return (value / 1024).toFixed(2);
}

async function main() {
  const allFiles = await listFilesRecursively(DIST_DIR);
  const bundleFiles = allFiles.filter((filePath) => /\.(js|css)$/i.test(filePath));

  const rows = [];
  let totalBytes = 0;

  for (const filePath of bundleFiles) {
    const fileStat = await stat(filePath);
    totalBytes += fileStat.size;

    rows.push({
      file: path.relative(DIST_DIR, filePath).replace(/\\/g, '/'),
      bytes: fileStat.size
    });
  }

  rows.sort((a, b) => b.bytes - a.bytes);

  await mkdir(REPORT_DIR, { recursive: true });

  const summaryLines = [
    '# Bundle Size Report',
    '',
    `- Dist folder: \`${DIST_DIR}\``,
    `- Files counted: ${rows.length} (.js + .css)`,
    `- Total bundle size: ${toKb(totalBytes)} KB`,
    `- Limit: ${MAX_KB} KB`,
    `- Status: ${totalBytes <= MAX_BYTES ? 'PASS' : 'FAIL'}`,
    '',
    '## Top 20 largest files',
    '',
    '| File | Size (KB) |',
    '|---|---:|'
  ];

  for (const row of rows.slice(0, 20)) {
    summaryLines.push(`| ${row.file} | ${toKb(row.bytes)} |`);
  }

  summaryLines.push('');

  await writeFile(path.join(REPORT_DIR, 'summary.md'), `${summaryLines.join('\n')}\n`, 'utf8');
  await writeFile(
    path.join(REPORT_DIR, 'bundle-size.json'),
    `${JSON.stringify({
      totalBytes,
      totalKb: Number(toKb(totalBytes)),
      limitKb: MAX_KB,
      status: totalBytes <= MAX_BYTES ? 'PASS' : 'FAIL',
      files: rows
    }, null, 2)}\n`,
    'utf8'
  );

  if (totalBytes > MAX_BYTES) {
    throw new Error(`Bundle size ${toKb(totalBytes)} KB exceeds limit ${MAX_KB} KB`);
  }

  console.log(`Bundle size check passed: ${toKb(totalBytes)} KB <= ${MAX_KB} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
