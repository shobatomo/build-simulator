import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { heroes, items } from './data/mockData';
import type { Locale, SelectedItem } from './types';
import { calculateStats, statKeys, statLabels } from './utils/calculateStats';
import './styles.css';

const copy = {
  en: { title: 'Deadlock Build Simulator', subtitle: 'MVP mock data. Designed for future weekly API sync into Supabase.', hero: 'Hero', level: 'Level', items: 'Items', build: 'Build', stats: 'Stats & Parameters', selectHero: 'Select hero', conditional: 'Conditional effects', empty: 'Pick items from the left panel.', lang: '日本語' },
  ja: { title: 'Deadlock ビルドシミュレーター', subtitle: 'MVPはモックデータです。将来は外部APIから週次同期してSupabaseを更新します。', hero: 'ヒーロー', level: 'レベル', items: 'アイテム', build: 'ビルド', stats: 'ステータス・パラメータ', selectHero: 'ヒーロー選択', conditional: '条件付き効果', empty: '左側の一覧からアイテムを選択してください。', lang: 'English' },
};

export default function App() {
  const [locale, setLocale] = useState<Locale>('ja');
  const [heroId, setHeroId] = useState(heroes[0].id);
  const [level, setLevel] = useState(1);
  const [isHeroModalOpen, setHeroModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const hero = heroes.find((candidate) => candidate.id === heroId) ?? heroes[0];
  const stats = useMemo(() => calculateStats(hero, level, selectedItems, items), [hero, level, selectedItems]);
  const t = copy[locale];

  const addItem = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    setSelectedItems((current) => [...current, { instanceId: crypto.randomUUID(), itemId, enabledEffectIds: item?.effects.filter((effect) => effect.defaultEnabled).map((effect) => effect.id) ?? [] }]);
  };

  const toggleEffect = (instanceId: string, effectId: string) => {
    setSelectedItems((current) => current.map((selected) => selected.instanceId !== instanceId ? selected : { ...selected, enabledEffectIds: selected.enabledEffectIds.includes(effectId) ? selected.enabledEffectIds.filter((id) => id !== effectId) : [...selected.enabledEffectIds, effectId] }));
  };

  return <main className="app-shell">
    <section className="left-panel">
      <header className="top-bar">
        <button className="hero-button" onClick={() => setHeroModalOpen(true)} aria-label={t.selectHero}><span>{hero.icon}</span><strong>{hero.name[locale]}</strong><small>{hero.role[locale]}</small></button>
        <label className="level-control">{t.level}<input type="number" min="1" max="30" value={level} onChange={(event) => setLevel(Math.min(30, Math.max(1, Number(event.target.value))))} /></label>
      </header>
      <div><h1>{t.title}</h1><p className="subtitle">{t.subtitle}</p></div>
      <section className="item-grid" aria-label={t.items}>{items.map((item) => <button className="item-card" key={item.id} onClick={() => addItem(item.id)}><span className="item-icon">{item.icon}</span><strong>{item.name[locale]}</strong><small>{item.category[locale]} · {item.price}</small><Plus size={16} /></button>)}</section>
    </section>
    <section className="right-panel">
      <div className="right-header"><h2>{t.build}</h2><button className="language-toggle" onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}>{t.lang}</button></div>
      <section className="build-list">{selectedItems.length === 0 ? <p>{t.empty}</p> : selectedItems.map((selected) => { const item = items.find((candidate) => candidate.id === selected.itemId); if (!item) return null; return <article className="build-item" key={selected.instanceId}><div><span>{item.icon}</span><strong>{item.name[locale]}</strong></div><button onClick={() => setSelectedItems((current) => current.filter((entry) => entry.instanceId !== selected.instanceId))}><X size={16} /></button>{item.effects.filter((effect) => effect.conditional).length > 0 && <div className="effects"><small>{t.conditional}</small>{item.effects.filter((effect) => effect.conditional).map((effect) => <label key={effect.id}><input type="checkbox" checked={selected.enabledEffectIds.includes(effect.id)} onChange={() => toggleEffect(selected.instanceId, effect.id)} />{effect.name[locale]}</label>)}</div>}</article>; })}</section>
      <section className="stats-panel"><h2>{t.stats}</h2>{statKeys.map((key) => <div className="stat-row" key={key}><span>{statLabels[key][locale]}</span><strong>{Number.isInteger(stats[key]) ? stats[key] : stats[key].toFixed(2)}</strong></div>)}</section>
    </section>
    {isHeroModalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><div className="modal-heading"><h2>{t.selectHero}</h2><button onClick={() => setHeroModalOpen(false)}><X /></button></div>{heroes.map((candidate) => <button className="hero-choice" key={candidate.id} onClick={() => { setHeroId(candidate.id); setHeroModalOpen(false); }}><span>{candidate.icon}</span><div><strong>{candidate.name[locale]}</strong><small>{candidate.role[locale]}</small></div></button>)}</div></div>}
  </main>;
}
