import type { SelectedItem } from '../types';
import type { ItemUpgradeIndex } from './itemUpgrades';

export interface SelectionNotice {
  kind: 'added' | 'removed' | 'replaced' | 'blocked-upgrade' | 'full' | 'invalid-item';
  itemId: string;
  relatedIds: string[];
}

export interface ItemSelectionState {
  items: SelectedItem[];
  notice: SelectionNotice | null;
}

export function toggleBuildItem(
  current: ItemSelectionState, itemId: string, index: ItemUpgradeIndex, instanceId: string,
): ItemSelectionState {
  const result = (kind: SelectionNotice['kind'], items = current.items, relatedIds: string[] = []): ItemSelectionState =>
    ({ items, notice: { kind, itemId, relatedIds } });
  if (current.items.some((selected) => selected.itemId === itemId)) {
    return result('removed', current.items.filter((selected) => selected.itemId !== itemId));
  }
  const item = index.byId.get(itemId);
  if (!item || index.duplicateIds.has(itemId) || item.upgradeRelations?.diagnostics.some((issue) => issue.code === 'cycle' || issue.code === 'duplicate-id')) {
    return result('invalid-item');
  }
  const blockingIds = [...new Set(current.items.filter((selected) =>
    index.upgradesByComponentId.get(itemId)?.has(selected.itemId)).map((selected) => selected.itemId))];
  if (blockingIds.length) return result('blocked-upgrade', current.items, blockingIds);
  const ancestors = new Set(item.upgradeRelations?.ancestorIds ?? []);
  const removedIds = [...new Set(current.items.filter((selected) => ancestors.has(selected.itemId)).map((selected) => selected.itemId))];
  const remaining = current.items.filter((selected) => !ancestors.has(selected.itemId));
  // Check capacity after replacing all confirmed components, including ancestors.
  if (remaining.length >= 12) return result('full');
  return result(removedIds.length ? 'replaced' : 'added', [...remaining, {
    instanceId, itemId,
    // Component activation state never transfers to the new item's effects.
    enabledEffectIds: item.effects.filter((effect) => effect.defaultEnabled).map((effect) => effect.id),
  }], removedIds);
}
