import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import madge from 'madge';

const SOURCE_DIR = 'src/app';
const OUTPUT_DIR = path.resolve('reports/dependency-graph');

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function toMermaid(graph) {
  const nodePaths = sortedUnique([
    ...Object.keys(graph),
    ...Object.values(graph).flat()
  ]);

  const nodeIds = new Map(nodePaths.map((nodePath, index) => [nodePath, `N${index + 1}`]));

  const lines = ['graph TD'];

  for (const nodePath of nodePaths) {
    const nodeId = nodeIds.get(nodePath);
    const label = nodePath.replace(/"/g, '\\"');
    lines.push(`  ${nodeId}["${label}"]`);
  }

  for (const from of Object.keys(graph).sort((a, b) => a.localeCompare(b))) {
    const fromId = nodeIds.get(from);
    for (const to of sortedUnique(graph[from])) {
      const toId = nodeIds.get(to);
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  return lines.join('\n') + '\n';
}

function isLikelyComponentFile(filePath) {
  if (!filePath.endsWith('.ts')) {
    return false;
  }

  if (filePath.endsWith('.spec.ts') || filePath.endsWith('.pipe.ts')) {
    return false;
  }

  if (filePath.includes('/core/') || filePath.includes('/dto/') || filePath.includes('/models/')) {
    return false;
  }

  if (filePath.endsWith('-data.ts')) {
    return false;
  }

  return filePath === 'app.ts'
    || filePath.startsWith('features/')
    || filePath.startsWith('shared/');
}

function buildComponentGraph(graph) {
  const componentNodes = new Set(
    Object.keys(graph).filter((filePath) => isLikelyComponentFile(filePath))
  );

  const componentGraph = {};

  for (const from of sortedUnique([...componentNodes])) {
    const deps = sortedUnique((graph[from] ?? []).filter((dep) => componentNodes.has(dep)));
    componentGraph[from] = deps;
  }

  return componentGraph;
}

function countEdges(graph) {
  return Object.values(graph).reduce((acc, deps) => acc + deps.length, 0);
}

async function main() {
  const result = await madge(SOURCE_DIR, {
    fileExtensions: ['ts'],
    tsConfig: path.resolve('tsconfig.app.json'),
    includeNpm: false
  });

  const graph = result.obj();
  const componentGraph = buildComponentGraph(graph);
  const circular = result.circular();

  await mkdir(OUTPUT_DIR, { recursive: true });

  const graphJsonPath = path.join(OUTPUT_DIR, 'graph.json');
  const graphMmdPath = path.join(OUTPUT_DIR, 'graph.mmd');
  const componentGraphJsonPath = path.join(OUTPUT_DIR, 'component-graph.json');
  const componentGraphMmdPath = path.join(OUTPUT_DIR, 'component-graph.mmd');
  const summaryPath = path.join(OUTPUT_DIR, 'summary.md');

  await writeFile(graphJsonPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  await writeFile(graphMmdPath, toMermaid(graph), 'utf8');
  await writeFile(componentGraphJsonPath, `${JSON.stringify(componentGraph, null, 2)}\n`, 'utf8');
  await writeFile(componentGraphMmdPath, toMermaid(componentGraph), 'utf8');

  const summaryLines = [
    '# Dependency Graph',
    '',
    `- Source: \`${SOURCE_DIR}\``,
    `- Modules: ${Object.keys(graph).length}`,
    `- Edges: ${countEdges(graph)}`,
    `- Components: ${Object.keys(componentGraph).length}`,
    `- Component edges: ${countEdges(componentGraph)}`,
    `- Circular dependencies: ${circular.length}`,
    '',
    '## Artifacts',
    '',
    '- `graph.json`',
    '- `graph.mmd`',
    '- `component-graph.json`',
    '- `component-graph.mmd`',
    '',
    '## Circular Dependencies',
    ''
  ];

  if (circular.length === 0) {
    summaryLines.push('- none');
  } else {
    for (const cycle of circular) {
      summaryLines.push(`- ${cycle.join(' -> ')}`);
    }
  }

  summaryLines.push('');

  await writeFile(summaryPath, `${summaryLines.join('\n')}\n`, 'utf8');

  console.log(`Dependency graph generated in: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
