import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { loadTs, plain } from './helpers/load-ts.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/item-upgrades-6807.public.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const { formatItemData } = loadTs('app/api/_lib/deadlockData.ts');
const { resolveUpgradeRelations, indexItemUpgrades } = loadTs('domain/itemUpgrades.ts');
const { toggleBuildItem } = loadTs('domain/itemSelection.ts');
const { calculateStats } = loadTs('utils/calculateStats.ts');
const items = formatItemData(fixture.items, fixture.items);
const index = indexItemUpgrades(items);
const rawByClass = (name) => fixture.items.find((item) => item.class_name === name);
const id = (name) => String(rawByClass(name).id);
const spirit = id('upgrade_improved_spirit');
const improved = id('upgrade_soaring_spirit');
const boundless = id('upgrade_boundless_spirit');
const velocity = id('upgrade_high_velocity_mag');
const range = id('upgrade_long_range');
const sharpshooter = id('upgrade_sharpshooter');
const opening = id('upgrade_pristine_emblem');
const selected = (itemId, enabledEffectIds = []) => ({ itemId, instanceId: `instance-${itemId}`, enabledEffectIds });
const state = (...ids) => ({ items: ids.map((itemId) => selected(itemId)), notice: null });
const toggle = (current, itemId, graph = index) => toggleBuildItem(current, itemId, graph, `new-${itemId}`);
const selectionIds = (result) => plain(result.items.map((entry) => entry.itemId));
const relationInputs = (rows) => rows.map((row) => ({ id: String(row.id), className: row.class_name, componentClassNames: row.component_items }));

test('captured API 6807 relationships survive formatter and resolve by class_name to ID', () => {
  assert.equal(fixture.clientVersion, 6807);
  assert.equal(items.length, 173);
  const item = index.byId.get(sharpshooter);
  assert.equal(item.className, 'upgrade_sharpshooter');
  assert.deepEqual(plain(item.upgradeRelations.componentIds), [range, velocity]);
  assert.equal(item.upgradeRelations.status, 'resolved');
  assert.ok(index.upgradesByComponentId.get(velocity).has(sharpshooter));
  assert.ok(index.directUpgradesByComponentId.get(velocity).has(opening));
});

test('direct upgrade replaces its selected component without relying on display names', () => {
  const renamed = items.map((item) => ({ ...item, name: { en: `unrelated-${item.id}`, ja: `別名-${item.id}` } }));
  const result = toggle(state(spirit), improved, indexItemUpgrades(renamed));
  assert.deepEqual(selectionIds(result), [improved]);
  assert.equal(result.notice.kind, 'replaced');
});

test('multi-stage upgrade removes all selected ancestors', () => {
  const result = toggle(state(spirit, improved), boundless);
  assert.deepEqual(selectionIds(result), [boundless]);
  assert.deepEqual(plain(result.notice.relatedIds), [spirit, improved]);
});

test('multiple direct components are all removed', () => {
  assert.deepEqual(selectionIds(toggle(state(range, velocity), sharpshooter)), [sharpshooter]);
});

test('shared-component branches are retained together; no sibling exclusivity is inferred', () => {
  const result = toggle(state(opening), sharpshooter);
  assert.deepEqual(selectionIds(result), [opening, sharpshooter]);
  const backward = toggle(result, velocity);
  assert.equal(backward.notice.kind, 'blocked-upgrade');
  assert.deepEqual(plain(backward.notice.relatedIds), [opening, sharpshooter]);
  assert.equal(backward.items, result.items);
});

test('direct and multi-stage downgrade attempts are rejected with a reason, without deleting the upgrade', () => {
  for (const component of [spirit, improved]) {
    const current = state(boundless);
    const result = toggle(current, component);
    assert.equal(result.notice.kind, 'blocked-upgrade');
    assert.deepEqual(plain(result.notice.relatedIds), [boundless]);
    assert.equal(result.items, current.items);
  }
});

test('clicking a selected item toggles it off instead of adding a duplicate', () => {
  assert.deepEqual(selectionIds(toggle(state(spirit), spirit)), []);
  const duplicated = { items: [selected(spirit), { ...selected(spirit), instanceId: 'duplicate' }], notice: null };
  assert.deepEqual(selectionIds(toggle(duplicated, improved)), [improved]);
});

const fillerItems = Array.from({ length: 12 }, (_, number) => ({
  ...items[0], id: `filler-${number}`, className: `filler-${number}`,
  upgradeRelations: { source: 'api-component-items', status: 'resolved', componentClassNames: [], componentIds: [], ancestorIds: [], diagnostics: [] },
}));
const fullIndex = indexItemUpgrades([...items, ...fillerItems]);

test('12 full slots allow a component replacement, including replacing multiple components', () => {
  const current = state(spirit, ...fillerItems.slice(0, 11).map((item) => item.id));
  const result = toggle(current, boundless, fullIndex);
  assert.equal(result.items.length, 12);
  assert.ok(!selectionIds(result).includes(spirit));
  assert.ok(selectionIds(result).includes(boundless));
  const multiple = toggle(state(range, velocity, ...fillerItems.slice(0, 10).map((item) => item.id)), sharpshooter, fullIndex);
  assert.equal(multiple.items.length, 11);
});

test('12 unrelated slots reject additions and preserve activation state', () => {
  const current = state(...fillerItems.map((item) => item.id));
  current.items[0].enabledEffectIds = ['already-enabled'];
  const result = toggle(current, boundless, fullIndex);
  assert.equal(result.notice.kind, 'full');
  assert.equal(result.items, current.items);
});

test('removed component effects are cleared, never transferred, and no longer affect calculated stats', () => {
  const effect = { id: 'conditional', name: { en: 'Test', ja: '検証' }, description: { en: '', ja: '' }, stats: { health: 90 }, conditional: true, defaultEnabled: false };
  const affected = items.map((item) => [spirit, improved].includes(item.id) ? { ...item, stats: {}, effects: [effect] } : item);
  const graph = indexItemUpgrades(affected);
  const current = { items: [selected(spirit, ['conditional'])], notice: null };
  const before = JSON.stringify(current);
  const result = toggle(current, improved, graph);
  assert.deepEqual(plain(result.items[0].enabledEffectIds), []);
  assert.equal(JSON.stringify(current), before);
  const zero = { health: 0, weaponDamage: 0, fireRate: 0, spiritPower: 0, moveSpeed: 0, stamina: 0, cooldownReduction: 0, lightMeleeDamage: 0, heavyMeleeDamage: 0, range: 0 };
  const hero = { baseStats: { ...zero, health: 100 }, growthPerLevel: zero };
  assert.equal(calculateStats(hero, 1, current.items, affected).health, 190);
  assert.equal(calculateStats(hero, 1, result.items, affected).health, 100);
  assert.deepEqual(plain(toggle(state(), spirit, graph).items[0].enabledEffectIds), []);
});

test('new item uses only its own default-enabled effects; unrelated selected effects survive', () => {
  const affected = items.map((item) => item.id === improved ? { ...item, effects: [{ ...items[0].effects[0], id: 'new-default', defaultEnabled: true }] } : item);
  const current = { items: [selected(spirit, ['old-active']), selected(opening, ['keep-active'])], notice: null };
  const result = toggle(current, improved, indexItemUpgrades(affected));
  assert.deepEqual(plain(result.items.find((item) => item.itemId === improved).enabledEffectIds), ['new-default']);
  assert.deepEqual(plain(result.items.find((item) => item.itemId === opening).enabledEffectIds), ['keep-active']);
});

test('hidden intermediate API records still resolve transitive ancestors before shop filtering', () => {
  const raw = fixture.items.map((item) => String(item.id) === improved ? { ...item, shopable: false } : item);
  const formatted = formatItemData(raw, raw);
  assert.ok(!formatted.some((item) => item.id === improved));
  assert.deepEqual(selectionIds(toggle(state(spirit), boundless, indexItemUpgrades(formatted))), [boundless]);
});

test('duplicate component entries are deduplicated without duplicate removals', () => {
  const raw = fixture.items.map((item) => String(item.id) === sharpshooter ? { ...item, component_items: [...item.component_items, ...item.component_items] } : item);
  const graph = indexItemUpgrades(formatItemData(raw, raw));
  assert.deepEqual(plain(graph.byId.get(sharpshooter).upgradeRelations.componentIds), [range, velocity]);
});

test('missing references produce diagnostics and never infer links from identical names', () => {
  const raw = fixture.items.map((item) => String(item.id) === improved ? { ...item, component_items: ['missing_class'], name: rawByClass('upgrade_improved_spirit').name } : item);
  const graph = indexItemUpgrades(formatItemData(raw, raw));
  assert.ok(graph.diagnostics.some((issue) => issue.code === 'missing-reference' && issue.reference === 'missing_class'));
  assert.deepEqual(selectionIds(toggle(state(spirit), improved, graph)), [spirit, improved]);
});

test('ambiguous class names and duplicate IDs are diagnosed instead of guessed', () => {
  const raw = [...fixture.items, { ...rawByClass('upgrade_improved_spirit'), id: 123 }];
  const graph = resolveUpgradeRelations(relationInputs(raw));
  assert.ok(graph[improved].diagnostics.some((issue) => issue.code === 'ambiguous-reference'));
  assert.deepEqual(plain(graph[improved].ancestorIds), []);
  const duplicate = indexItemUpgrades([...items, items.find((item) => item.id === spirit)]);
  assert.equal(toggle(state(), spirit, duplicate).notice.kind, 'invalid-item');
});

test('cycles and malformed component arrays are diagnosable and cyclic selection is rejected', () => {
  const raw = fixture.items.map((item) => String(item.id) === spirit ? { ...item, component_items: ['upgrade_soaring_spirit'] } : item);
  const graph = indexItemUpgrades(formatItemData(raw, raw));
  assert.ok(graph.diagnostics.some((issue) => issue.code === 'cycle'));
  assert.equal(toggle(state(), improved, graph).notice.kind, 'invalid-item');
  const malformed = resolveUpgradeRelations([{ id: '1', className: 'one', componentClassNames: [42] }]);
  assert.equal(malformed['1'].status, 'unresolved');
  assert.equal(malformed['1'].diagnostics[0].code, 'invalid-components');
});

test('legacy formatted data remains unavailable and never triggers the old name heuristic', () => {
  const legacy = items.map((item) => { const copy = { ...item }; delete copy.upgradeRelations; delete copy.className; return copy; });
  const graph = indexItemUpgrades(legacy);
  assert.equal(graph.unavailableIds.length, legacy.length);
  assert.equal(graph.upgradesByComponentId.size, 0);
  assert.deepEqual(selectionIds(toggle(state(spirit), improved, graph)), [spirit, improved]);
});
