import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('public/data/example-recipes.json');
const OUT_DIR = path.resolve('public/assets/recipes/photos');
const JSON_INDENT = 2;

const args = process.argv.slice(2);
const force = args.includes('--force');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Number.POSITIVE_INFINITY;
const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));
const concurrency = Math.max(1, Number(concurrencyArg?.split('=')[1] ?? 6));

const contentTypeToExtension = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildQueries(recipe) {
  const title = normalize(recipe.title);
  const category = normalize(recipe.category);
  const cuisine = normalize(recipe.cuisine);

  return [
    `${title} ${category} ${cuisine} dish`,
    `${category} ${cuisine} food`,
    `${title} ${cuisine} cuisine`,
    `${category} food photography`,
    `${cuisine} cuisine food`
  ]
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function sourceApiUrl(query, seed) {
  return `https://source.unsplash.com/640x420/?${encodeURIComponent(query)}&sig=${seed}`;
}

async function fetchImageForRecipe(recipe, index) {
  const queries = buildQueries(recipe);

  for (const query of queries) {
    const url = sourceApiUrl(query, index + 1);

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'Accept': 'image/*'
        }
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type')?.split(';')[0].toLowerCase() ?? 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        continue;
      }

      const extension = contentTypeToExtension[contentType] ?? 'jpg';
      const bytes = Buffer.from(await response.arrayBuffer());

      if (bytes.length < 10_000) {
        continue;
      }

      return {
        bytes,
        extension,
        matchedQuery: query,
        sourceUrl: response.url
      };
    } catch {
      // Ignore and try next query.
    }
  }

  return null;
}

async function runWithConcurrency(items, worker, maxConcurrency) {
  let current = 0;
  const workers = Array.from({ length: maxConcurrency }, async () => {
    while (true) {
      const index = current;
      current += 1;
      if (index >= items.length) {
        return;
      }

      await worker(items[index], index);
    }
  });

  await Promise.all(workers);
}

function buildFileBaseName(index) {
  return `recipe-${String(index + 1).padStart(4, '0')}`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const rawJson = await readFile(DATA_PATH, 'utf8');
  const json = rawJson.replace(/^\uFEFF/, '');
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('example-recipes.json must contain an array.');
  }

  const recipes = parsed.slice(0, Number.isFinite(limit) ? limit : parsed.length);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  await runWithConcurrency(recipes, async (recipe, index) => {
    const fileBaseName = buildFileBaseName(index);
    const existingLocalImage = normalize(recipe.image);
    const canSkip = !force && existingLocalImage.startsWith('assets/recipes/photos/');

    if (canSkip) {
      skipped += 1;
      return;
    }

    const photo = await fetchImageForRecipe(recipe, index);
    if (!photo) {
      failed += 1;
      return;
    }

    const fileName = `${fileBaseName}.${photo.extension}`;
    const filePath = path.join(OUT_DIR, fileName);

    await writeFile(filePath, photo.bytes);
    recipe.image = `assets/recipes/photos/${fileName}`;
    downloaded += 1;

    if ((downloaded + failed + skipped) % 25 === 0) {
      console.log(`Processed ${downloaded + failed + skipped}/${recipes.length}...`);
    }
  }, concurrency);

  await writeFile(DATA_PATH, `${JSON.stringify(parsed, null, JSON_INDENT)}\n`, 'utf8');

  console.log('--- Sync summary ---');
  console.log(`Total recipes: ${parsed.length}`);
  console.log(`Targeted: ${recipes.length}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Output dir: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
