import type { Item, ItemUpgradeRelations, UpgradeDiagnostic } from '../types';

export interface UpgradeSource {
  id: string;
  className: string | null;
  componentClassNames: unknown;
}

// Resolve against the full API collection before filtering visible shop items.
// Missing/null component_items in an API record declares no component edges.
// This is distinct from legacy formatted items with no upgradeRelations metadata.
export function resolveUpgradeRelations(sources: UpgradeSource[]): Record<string, ItemUpgradeRelations> {
  const ids = new Map<string, UpgradeSource[]>();
  const classes = new Map<string, Set<string>>();
  for (const source of sources) {
    ids.set(source.id, [...(ids.get(source.id) ?? []), source]);
    if (source.className) classes.set(source.className, new Set([...(classes.get(source.className) ?? []), source.id]));
  }
  const direct = new Map<string, { names: string[]; ids: string[]; diagnostics: UpgradeDiagnostic[] }>();
  for (const [id, matches] of ids) {
    const source = matches[0];
    const diagnostics: UpgradeDiagnostic[] = [];
    const add = (code: UpgradeDiagnostic['code'], reference?: string) => diagnostics.push({ code, itemId: id, reference });
    if (matches.length !== 1) add('duplicate-id', id);
    if (!source.className) add('missing-class-name');
    const raw = source.componentClassNames;
    const valid = raw == null || (Array.isArray(raw) && raw.every((name) => typeof name === 'string' && name.length > 0));
    if (!valid) add('invalid-components');
    const names: string[] = valid && Array.isArray(raw) ? [...new Set(raw)] : [];
    const componentIds: string[] = [];
    for (const name of names) {
      const candidates = [...(classes.get(name) ?? [])];
      if (candidates.length === 0) add('missing-reference', name);
      else if (candidates.length > 1 || ids.get(candidates[0])?.length !== 1) add('ambiguous-reference', name);
      else componentIds.push(candidates[0]);
    }
    direct.set(id, { names, ids: matches.length === 1 ? [...new Set(componentIds)] : [], diagnostics });
  }
  return Object.fromEntries([...direct].map(([id, entry]) => {
    const ancestors = new Set<string>();
    const diagnostics: UpgradeDiagnostic[] = [];
    const visited = new Set<string>();
    const visit = (current: string, path: Set<string>) => {
      if (path.has(current)) { diagnostics.push({ code: 'cycle', itemId: current, reference: current }); return; }
      if (visited.has(current)) return;
      visited.add(current);
      const node = direct.get(current)!;
      diagnostics.push(...node.diagnostics);
      const nextPath = new Set([...path, current]);
      for (const child of node.ids) { ancestors.add(child); visit(child, nextPath); }
    };
    visit(id, new Set());
    const cyclic = diagnostics.some((issue) => issue.code === 'cycle');
    return [id, {
      source: 'api-component-items', status: diagnostics.length ? 'unresolved' : 'resolved',
      componentClassNames: entry.names, componentIds: entry.ids,
      ancestorIds: cyclic ? [] : [...ancestors].filter((ancestor) => ancestor !== id),
      diagnostics,
    } satisfies ItemUpgradeRelations];
  }));
}

export function indexItemUpgrades(items: Item[]) {
  const byId = new Map<string, Item>();
  const duplicateIds = new Set<string>();
  const upgradesByComponentId = new Map<string, Set<string>>();
  const directUpgradesByComponentId = new Map<string, Set<string>>();
  const unavailableIds: string[] = [];
  const diagnostics: UpgradeDiagnostic[] = [];
  for (const item of items) {
    if (byId.has(item.id)) duplicateIds.add(item.id);
    byId.set(item.id, item);
    const relation = item.upgradeRelations;
    if (!relation || relation.source !== 'api-component-items') { unavailableIds.push(item.id); continue; }
    diagnostics.push(...relation.diagnostics);
    for (const ancestor of relation.ancestorIds) {
      const upgrades = upgradesByComponentId.get(ancestor) ?? new Set<string>();
      upgrades.add(item.id); upgradesByComponentId.set(ancestor, upgrades);
    }
    for (const component of relation.componentIds) {
      const upgrades = directUpgradesByComponentId.get(component) ?? new Set<string>();
      upgrades.add(item.id); directUpgradesByComponentId.set(component, upgrades);
    }
  }
  return { byId, duplicateIds, upgradesByComponentId, directUpgradesByComponentId, unavailableIds, diagnostics };
}

export type ItemUpgradeIndex = ReturnType<typeof indexItemUpgrades>;
