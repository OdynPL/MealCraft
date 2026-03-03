import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import madge from 'madge';

const SOURCE_DIR = 'src/app';
const OUTPUT_DIR = path.resolve('reports/dependency-graph');
const ROUTES_FILE = path.resolve(SOURCE_DIR, 'app.routes.ts');

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
  const hasRouteEdges = Object.keys(graph).some((nodePath) => nodePath.startsWith('route:'));

  for (const nodePath of nodePaths) {
    const nodeId = nodeIds.get(nodePath);
    const label = nodePath.replace(/"/g, '\\"');
    lines.push(`  ${nodeId}["${label}"]`);
  }

  for (const from of Object.keys(graph).sort((a, b) => a.localeCompare(b))) {
    const fromId = nodeIds.get(from);
    const isRouteNode = from.startsWith('route:');
    for (const to of sortedUnique(graph[from])) {
      const toId = nodeIds.get(to);
      lines.push(isRouteNode ? `  ${fromId} -. route .-> ${toId}` : `  ${fromId} --> ${toId}`);
    }
  }

  if (hasRouteEdges) {
    lines.push('');
    lines.push('  subgraph LEGEND[Legend]');
    lines.push('    L1["Component/Module"]');
    lines.push('    L2["Imported dependency"]');
    lines.push('    L3["Route node"]');
    lines.push('    L4["Lazy-loaded component"]');
    lines.push('  end');
    lines.push('  L1 --> L2');
    lines.push('  L3 -. route .-> L4');
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

function normalizeImportedComponentPath(importPath) {
  const withoutPrefix = importPath.replace(/^\.\//, '');
  return withoutPrefix.endsWith('.ts') ? withoutPrefix : `${withoutPrefix}.ts`;
}

function normalizeRoutePath(routePath) {
  if (routePath === '') {
    return '/';
  }

  return routePath.startsWith('/') ? routePath : `/${routePath}`;
}

async function extractRouteComponentEdges(componentNodes) {
  const routesContent = await readFile(ROUTES_FILE, 'utf8');
  const routeEdgeRegex = /path:\s*'([^']*)'[\s\S]*?loadComponent:\s*\(\)\s*=>\s*import\('([^']+)'\)/g;

  const routeEdges = [];
  let match = routeEdgeRegex.exec(routesContent);

  while (match) {
    const routePath = normalizeRoutePath(match[1]);
    const componentPath = normalizeImportedComponentPath(match[2]);

    if (componentNodes.has(componentPath)) {
      routeEdges.push({
        routeNode: `route:${routePath}`,
        componentPath
      });
    }

    match = routeEdgeRegex.exec(routesContent);
  }

  return routeEdges;
}

function countEdges(graph) {
  return Object.values(graph).reduce((acc, deps) => acc + deps.length, 0);
}

function buildRootedTreeGraph(componentGraph, rootNode = 'app.ts') {
  const sourceGraph = {};

  for (const [node, deps] of Object.entries(componentGraph)) {
    sourceGraph[node] = sortedUnique(deps ?? []);
  }

  const routeNodes = sortedUnique(Object.keys(sourceGraph).filter((node) => node.startsWith('route:')));
  sourceGraph[rootNode] = sortedUnique([...(sourceGraph[rootNode] ?? []), ...routeNodes]);

  const treeGraph = {
    [rootNode]: []
  };

  const visited = new Set([rootNode]);
  const queue = [rootNode];

  while (queue.length > 0) {
    const from = queue.shift();
    const children = sortedUnique(sourceGraph[from] ?? []);

    for (const child of children) {
      if (visited.has(child)) {
        continue;
      }

      visited.add(child);
      queue.push(child);
      treeGraph[from] = sortedUnique([...(treeGraph[from] ?? []), child]);
      treeGraph[child] = treeGraph[child] ?? [];
    }

    treeGraph[from] = treeGraph[from] ?? [];
  }

  return treeGraph;
}

async function main() {
  const result = await madge(SOURCE_DIR, {
    fileExtensions: ['ts'],
    tsConfig: path.resolve('tsconfig.app.json'),
    includeNpm: false
  });

  const graph = result.obj();
  const componentGraph = buildComponentGraph(graph);
  const componentNodes = new Set(Object.keys(componentGraph));
  const routeEdges = await extractRouteComponentEdges(componentNodes);

  for (const { routeNode, componentPath } of routeEdges) {
    componentGraph[routeNode] = sortedUnique([...(componentGraph[routeNode] ?? []), componentPath]);
  }

  const rootedTreeGraph = buildRootedTreeGraph(componentGraph, 'app.ts');

  const circular = result.circular();

  await mkdir(OUTPUT_DIR, { recursive: true });

  const graphJsonPath = path.join(OUTPUT_DIR, 'graph.json');
  const graphMmdPath = path.join(OUTPUT_DIR, 'graph.mmd');
  const componentGraphJsonPath = path.join(OUTPUT_DIR, 'component-graph.json');
  const componentGraphMmdPath = path.join(OUTPUT_DIR, 'component-graph.mmd');
  const componentTreeJsonPath = path.join(OUTPUT_DIR, 'component-tree.json');
  const componentTreeMmdPath = path.join(OUTPUT_DIR, 'component-tree.mmd');
  const summaryPath = path.join(OUTPUT_DIR, 'summary.md');

  await writeFile(graphJsonPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  await writeFile(graphMmdPath, toMermaid(graph), 'utf8');
  await writeFile(componentGraphJsonPath, `${JSON.stringify(componentGraph, null, 2)}\n`, 'utf8');
  await writeFile(componentGraphMmdPath, toMermaid(componentGraph), 'utf8');
  await writeFile(componentTreeJsonPath, `${JSON.stringify(rootedTreeGraph, null, 2)}\n`, 'utf8');
  await writeFile(componentTreeMmdPath, toMermaid(rootedTreeGraph), 'utf8');

  const summaryLines = [
    '# Dependency Graph',
    '',
    `- Source: \`${SOURCE_DIR}\``,
    `- Modules: ${Object.keys(graph).length}`,
    `- Edges: ${countEdges(graph)}`,
    `- Components: ${Object.keys(componentGraph).length}`,
    `- Component edges: ${countEdges(componentGraph)}`,
    `- Tree nodes (reachable from app.ts): ${Object.keys(rootedTreeGraph).length}`,
    `- Tree edges: ${countEdges(rootedTreeGraph)}`,
    `- Route edges: ${routeEdges.length}`,
    `- Circular dependencies: ${circular.length}`,
    '',
    '## Artifacts',
    '',
    '- `graph.json`',
    '- `graph.mmd`',
    '- `component-graph.json`',
    '- `component-graph.mmd`',
    '- `component-tree.json`',
    '- `component-tree.mmd`',
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
