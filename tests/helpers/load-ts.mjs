import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));

export function loadTs(relativePath) {
  const cache = new Map();
  function load(path) {
    const resolved = resolve(path);
    assert.ok(resolved.startsWith(sourceRoot.endsWith(sep) ? sourceRoot : sourceRoot + sep));
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const code = ts.transpileModule(readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(code, {
      exports: module.exports, module, URL, AbortSignal: globalThis.AbortSignal,
      process: { env: {} },
      fetch() { throw new Error('Unmocked network access is forbidden'); },
      require(name) {
        if (name === 'node:crypto') return crypto;
        assert.ok(name.startsWith('.'), `Unexpected dependency ${name}`);
        return load(resolve(dirname(resolved), name + '.ts'));
      },
    }, { filename: resolved });
    return module.exports;
  }
  return load(resolve(sourceRoot, relativePath));
}

export const plain = (value) => JSON.parse(JSON.stringify(value));
