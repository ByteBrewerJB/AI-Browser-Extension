import { resolve as tsNodeResolve, load as tsNodeLoad } from 'ts-node/esm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const loaderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(loaderDir, '..');
const srcRoot = path.join(projectRoot, 'src');

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === '@/core/storage/db') {
    const mockPath = path.join(projectRoot, 'tests/mocks/inMemoryDb.ts');
    const url = pathToFileURL(mockPath).href;
    return tsNodeResolve(url, context, defaultResolve);
  }

  if (specifier === './db' && context.parentURL?.includes('/src/core/storage/')) {
    const mockPath = path.join(projectRoot, 'tests/mocks/inMemoryDb.ts');
    const url = pathToFileURL(mockPath).href;
    return tsNodeResolve(url, context, defaultResolve);
  }

  if (specifier.startsWith('@/')) {
    const withoutAlias = specifier.slice(2);
    const basePath = path.join(srcRoot, withoutAlias);
    const attempts = [basePath, `${basePath}.ts`, path.join(basePath, 'index.ts')];

    let lastError;
    for (const attempt of attempts) {
      try {
        const url = pathToFileURL(attempt).href;
        return await tsNodeResolve(url, context, defaultResolve);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`Unable to resolve alias specifier ${specifier}`);
  }
  return tsNodeResolve(specifier, context, defaultResolve);
}

export const load = tsNodeLoad;
