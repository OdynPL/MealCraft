import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

const README_PATH = path.resolve('README.md');
const COVERAGE_ROOTS = [path.resolve('coverage'), path.resolve('coverage-report')];
const COVERAGE_THRESHOLD = Number(process.env.README_COVERAGE_THRESHOLD ?? '70');

const START_MARKER = '<!-- AUTO-DOCS:START -->';
const END_MARKER = '<!-- AUTO-DOCS:END -->';

async function findFileRecursively(rootDir, fileName) {
  if (!existsSync(rootDir)) {
    return null;
  }

  const direct = path.join(rootDir, fileName);
  if (existsSync(direct)) {
    return direct;
  }

  const queue = [rootDir];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
    }
  }

  return null;
}

async function findCoverageFilePath(fileName) {
  for (const root of COVERAGE_ROOTS) {
    const filePath = await findFileRecursively(root, fileName);
    if (filePath) {
      return filePath;
    }
  }

  return null;
}

function pct(covered, total) {
  if (total <= 0) {
    return 0;
  }

  return (covered / total) * 100;
}

function buildTotalsFromFinalCoverage(coverageFinal) {
  const totals = {
    statements: { total: 0, covered: 0, pct: 0 },
    branches: { total: 0, covered: 0, pct: 0 },
    functions: { total: 0, covered: 0, pct: 0 },
    lines: { total: 0, covered: 0, pct: 0 }
  };

  for (const fileCoverage of Object.values(coverageFinal ?? {})) {
    const statementHits = Object.values(fileCoverage?.s ?? {});
    totals.statements.total += statementHits.length;
    totals.statements.covered += statementHits.filter((value) => value > 0).length;

    const functionHits = Object.values(fileCoverage?.f ?? {});
    totals.functions.total += functionHits.length;
    totals.functions.covered += functionHits.filter((value) => value > 0).length;

    const branchHits = Object.values(fileCoverage?.b ?? {});
    for (const hitArray of branchHits) {
      const hits = Array.isArray(hitArray) ? hitArray : [];
      totals.branches.total += hits.length;
      totals.branches.covered += hits.filter((value) => value > 0).length;
    }

    const lineHits = Object.entries(fileCoverage?.l ?? {});
    if (lineHits.length > 0) {
      totals.lines.total += lineHits.length;
      totals.lines.covered += lineHits.filter(([, value]) => value > 0).length;
    } else {
      const linesById = Object.entries(fileCoverage?.statementMap ?? {}).map(([id, statement]) => ({
        id,
        line: statement?.start?.line
      }));
      const uniqueLines = new Set(linesById.map((item) => item.line).filter((line) => Number.isInteger(line)));
      const coveredLines = new Set(
        linesById
          .filter((item) => Number.isInteger(item.line) && Number((fileCoverage?.s ?? {})[item.id] ?? 0) > 0)
          .map((item) => item.line)
      );

      totals.lines.total += uniqueLines.size;
      totals.lines.covered += coveredLines.size;
    }
  }

  totals.statements.pct = pct(totals.statements.covered, totals.statements.total);
  totals.branches.pct = pct(totals.branches.covered, totals.branches.total);
  totals.functions.pct = pct(totals.functions.covered, totals.functions.total);
  totals.lines.pct = pct(totals.lines.covered, totals.lines.total);

  return totals;
}

function toPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }

  return `${value.toFixed(2)}%`;
}

function toStatusBadge(isPass) {
  return isPass ? '✅ PASS' : '❌ FAIL';
}

function resolveThresholdStatus(linesCoveragePct) {
  if (typeof linesCoveragePct !== 'number' || Number.isNaN(linesCoveragePct)) {
    return {
      status: 'n/a',
      pass: false
    };
  }

  const pass = linesCoveragePct >= COVERAGE_THRESHOLD;
  return {
    status: toStatusBadge(pass),
    pass
  };
}

async function buildCoverageTable() {
  const summaryPath = await findCoverageFilePath('coverage-summary.json');

  if (summaryPath) {
    const raw = await readFile(summaryPath, 'utf8');
    const parsed = JSON.parse(raw);
    const total = parsed?.total ?? {};
    const threshold = resolveThresholdStatus(total?.lines?.pct);

    return {
      hasCoverageData: true,
      thresholdPass: threshold.pass,
      markdown: [
      '### Coverage Report',
      '',
      '| Metric | Value |',
      '|---|---:|',
      `| Statements | ${toPercent(total?.statements?.pct)} |`,
      `| Branches | ${toPercent(total?.branches?.pct)} |`,
      `| Functions | ${toPercent(total?.functions?.pct)} |`,
      `| Lines | ${toPercent(total?.lines?.pct)} |`,
      `| Threshold (Lines >= ${COVERAGE_THRESHOLD}%) | ${threshold.status} |`,
      '',
      `_Source: ${path.relative(path.dirname(README_PATH), summaryPath).replace(/\\/g, '/')}._`,
      ''
    ].join('\n')
    };
  }

  const finalPath = await findCoverageFilePath('coverage-final.json');

  if (!finalPath) {
    return {
      hasCoverageData: false,
      thresholdPass: false,
      markdown: [
        '### Coverage Report',
        '',
        '_Coverage summary not found in workspace. Run `npm run test:ci:coverage` first._',
        ''
      ].join('\n')
    };
  }

  const raw = await readFile(finalPath, 'utf8');
  const parsed = JSON.parse(raw);
  const total = buildTotalsFromFinalCoverage(parsed);
  const threshold = resolveThresholdStatus(total?.lines?.pct);

  return {
    hasCoverageData: true,
    thresholdPass: threshold.pass,
    markdown: [
      '### Coverage Report',
      '',
      '| Metric | Value |',
      '|---|---:|',
      `| Statements | ${toPercent(total?.statements?.pct)} |`,
      `| Branches | ${toPercent(total?.branches?.pct)} |`,
      `| Functions | ${toPercent(total?.functions?.pct)} |`,
      `| Lines | ${toPercent(total?.lines?.pct)} |`,
      `| Threshold (Lines >= ${COVERAGE_THRESHOLD}%) | ${threshold.status} |`,
      '',
      `_Source: ${path.relative(path.dirname(README_PATH), finalPath).replace(/\\/g, '/')}._`,
      ''
    ].join('\n')
  };
}

function buildTestsStatusTable({ hasCoverageData, thresholdPass }) {
  const unitTestsStatus = hasCoverageData ? toStatusBadge(true) : '❓ UNKNOWN';
  const coverageTestsStatus = hasCoverageData ? toStatusBadge(true) : '❓ UNKNOWN';
  const coverageGateStatus = hasCoverageData ? toStatusBadge(thresholdPass) : '❓ UNKNOWN';

  return [
    '### Test Status',
    '',
    '| Test | Status |',
    '|---|---:|',
    '| Unit tests (`npm run test:ci`) | ' + unitTestsStatus + ' |',
    '| Coverage tests (`npm run test:ci:coverage`) | ' + coverageTestsStatus + ' |',
    `| Coverage threshold gate (Lines >= ${COVERAGE_THRESHOLD}%) | ${coverageGateStatus} |`,
    ''
  ].join('\n');
}

async function buildAutoDocsSection() {
  const coverageTable = await buildCoverageTable();
  const testsStatusTable = buildTestsStatusTable(coverageTable);

  return [
    START_MARKER,
    '## Automated Architecture Docs',
    '',
    'This section is auto-generated by CI during each `main` deployment pipeline run.',
    '',
    '### App Architecture',
    '',
    '![Component Tree](reports/dependency-graph/component-tree.svg)',
    '',
    coverageTable.markdown.trimEnd(),
    '',
    testsStatusTable.trimEnd(),
    END_MARKER,
    ''
  ].join('\n');
}

async function main() {
  const AUTO_DOCS_SECTION = await buildAutoDocsSection();
  const readmeContent = await readFile(README_PATH, 'utf8');
  const hasMarkers = readmeContent.includes(START_MARKER) && readmeContent.includes(END_MARKER);

  const nextContent = hasMarkers
    ? readmeContent.replace(new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`), AUTO_DOCS_SECTION.trimEnd())
    : `${readmeContent.trimEnd()}\n\n${AUTO_DOCS_SECTION}`;

  if (nextContent !== readmeContent) {
    await writeFile(README_PATH, nextContent, 'utf8');
    console.log('README.md updated with auto-generated architecture docs section.');
    return;
  }

  console.log('README.md is already up to date.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
