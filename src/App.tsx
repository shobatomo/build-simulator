import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { fetchDeadlockData } from "./api/deadlockApi";
import type { Hero, Item, Locale, SelectedItem } from "./types";

import { calculateStats, statKeys, statLabels } from "./utils/calculateStats";
import "./styles.css";

const isImageUrl = (value: string) => /^https?:\/\//.test(value);

const renderIcon = (value: string, alt: string, className?: string) =>
  isImageUrl(value) ? (
    <img className={className} src={value} alt={alt} loading="lazy" />
  ) : (
    <span className={className}>{value}</span>
  );

const copy = {
  en: {
    title: "Deadlock Build Simulator",
    subtitle:
      "Hero and item data is loaded from the Node API. The API can later read Supabase data refreshed by a weekly external sync.",
    level: "Level",
    items: "Items",
    build: "Build",
    stats: "Stats & Parameters",
    selectHero: "Select hero",
    conditional: "Conditional effects",
    empty: "Pick items from the left panel.",
    lang: "日本語",
    loading: "Loading heroes and items from API...",
    error: "Could not load API data.",
    retry: "Retry",
    price: "Price",
  },
  ja: {
    title: "Deadlock ビルドシミュレーター",
    subtitle:
      "ヒーローとアイテム情報はNode APIから取得します。将来は外部APIから週次同期したSupabaseデータをAPIが返す想定です。",
    level: "レベル",
    items: "アイテム",
    build: "ビルド",
    stats: "ステータス・パラメータ",
    selectHero: "ヒーロー選択",
    conditional: "条件付き効果",
    empty: "左側の一覧からアイテムを選択してください。",
    lang: "English",
    loading: "APIからヒーローとアイテムを読み込んでいます...",
    error: "APIデータを読み込めませんでした。",
    retry: "再試行",
    price: "価格",
  },
};

export default function App() {
  const [locale, setLocale] = useState<Locale>("ja");
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [heroId, setHeroId] = useState<string>();
  const [level, setLevel] = useState(1);
  const [isHeroModalOpen, setHeroModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const t = copy[locale];

  const loadBuildData = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const {
        heroes: apiHeroes,
        items: apiItems,
        assets: apiAssets,
      } = await fetchDeadlockData();
      void apiAssets;
      setHeroes(apiHeroes);
      setItems(apiItems);
      setHeroId((currentHeroId) => currentHeroId ?? apiHeroes[0]?.id);
      setSelectedItems((currentItems) =>
        currentItems.filter((selected) =>
          apiItems.some((item) => item.id === selected.itemId),
        ),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBuildData();
  }, []);

  const hero = heroes.find((candidate) => candidate.id === heroId);
  const stats = useMemo(
    () =>
      hero ? calculateStats(hero, level, selectedItems, items) : undefined,
    [hero, level, selectedItems, items],
  );

  const formatHeroDetails = (candidate: Hero) =>
    [candidate.name[locale], candidate.role[locale]]
      .filter(Boolean)
      .join(" / ");

  const formatItemDetails = (item: Item) =>
    `${item.name[locale]} / ${item.category[locale]} / ${t.price}: ${item.price}`;

  const addItem = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    setSelectedItems((current) => [
      ...current,
      {
        instanceId: crypto.randomUUID(),
        itemId,
        enabledEffectIds:
          item?.effects
            .filter((effect) => effect.defaultEnabled)
            .map((effect) => effect.id) ?? [],
      },
    ]);
  };

  const toggleEffect = (instanceId: string, effectId: string) => {
    setSelectedItems((current) =>
      current.map((selected) =>
        selected.instanceId !== instanceId
          ? selected
          : {
              ...selected,
              enabledEffectIds: selected.enabledEffectIds.includes(effectId)
                ? selected.enabledEffectIds.filter((id) => id !== effectId)
                : [...selected.enabledEffectIds, effectId],
            },
      ),
    );
  };

  if (isLoading) {
    return (
      <main className="app-shell status-screen">
        <p>{t.loading}</p>
      </main>
    );
  }

  if (error || !hero || !stats) {
    return (
      <main className="app-shell status-screen">
        <p>{t.error}</p>
        <small>{error}</small>
        <button
          className="language-toggle"
          onClick={() => void loadBuildData()}
        >
          {t.retry}
        </button>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="left-panel">
        <header className="top-bar">
          <button
            className="hero-button icon-only-card"
            onClick={() => setHeroModalOpen(true)}
            aria-label={`${t.selectHero}: ${hero.name[locale]}`}
            title={formatHeroDetails(hero)}
          >
            {renderIcon(hero.icon, hero.name[locale], "hero-icon")}
            <span className="hover-detail" role="tooltip">
              <strong>{hero.name[locale]}</strong>
              <small>{hero.role[locale]}</small>
            </span>
          </button>
          <label className="level-control">
            {t.level}
            <input
              type="number"
              min="1"
              max="30"
              value={level}
              onChange={(event) =>
                setLevel(Math.min(30, Math.max(1, Number(event.target.value))))
              }
            />
          </label>
        </header>
        <div>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <section className="item-grid" aria-label={t.items}>
          {items.map((item) => (
            <button
              className="item-card icon-only-card"
              key={item.id}
              onClick={() => addItem(item.id)}
              aria-label={formatItemDetails(item)}
              title={formatItemDetails(item)}
            >
              {renderIcon(item.icon, item.name[locale], "item-icon")}
              <span className="hover-detail" role="tooltip">
                <strong>{item.name[locale]}</strong>
                <small>
                  {item.category[locale]} · {item.price}
                </small>
                {item.effects.length > 0 && (
                  <small>
                    {item.effects
                      .map((effect) => effect.description[locale])
                      .filter(Boolean)
                      .join(" / ")}
                  </small>
                )}
              </span>
            </button>
          ))}
        </section>
      </section>
      <section className="right-panel">
        <div className="right-header">
          <h2>{t.build}</h2>
          <button
            className="language-toggle"
            onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
          >
            {t.lang}
          </button>
        </div>
        <section className="build-list">
          {selectedItems.length === 0 ? (
            <p>{t.empty}</p>
          ) : (
            selectedItems.map((selected) => {
              const item = items.find(
                (candidate) => candidate.id === selected.itemId,
              );
              if (!item) return null;
              return (
                <article className="build-item" key={selected.instanceId}>
                  <div>
                    {renderIcon(
                      item.icon,
                      item.name[locale],
                      "build-item-icon",
                    )}
                    <strong>{item.name[locale]}</strong>
                  </div>
                  <button
                    onClick={() =>
                      setSelectedItems((current) =>
                        current.filter(
                          (entry) => entry.instanceId !== selected.instanceId,
                        ),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                  {item.effects.filter((effect) => effect.conditional).length >
                    0 && (
                    <div className="effects">
                      <small>{t.conditional}</small>
                      {item.effects
                        .filter((effect) => effect.conditional)
                        .map((effect) => (
                          <label key={effect.id}>
                            <input
                              type="checkbox"
                              checked={selected.enabledEffectIds.includes(
                                effect.id,
                              )}
                              onChange={() =>
                                toggleEffect(selected.instanceId, effect.id)
                              }
                            />
                            {effect.name[locale]}
                          </label>
                        ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        <section className="stats-panel">
          <h2>{t.stats}</h2>
          {statKeys.map((key) => (
            <div className="stat-row" key={key}>
              <span>{statLabels[key][locale]}</span>
              <strong>
                {Number.isInteger(stats[key])
                  ? stats[key]
                  : stats[key].toFixed(2)}
              </strong>
            </div>
          ))}
        </section>
      </section>
      {isHeroModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-heading">
              <h2>{t.selectHero}</h2>
              <button onClick={() => setHeroModalOpen(false)}>
                <X />
              </button>
            </div>
            <div className="hero-choice-grid">
              {heroes.map((candidate) => (
                <button
                  className="hero-choice icon-only-card"
                  key={candidate.id}
                  onClick={() => {
                    setHeroId(candidate.id);
                    setHeroModalOpen(false);
                  }}
                  aria-label={formatHeroDetails(candidate)}
                  title={formatHeroDetails(candidate)}
                >
                  {renderIcon(
                    candidate.icon,
                    candidate.name[locale],
                    "hero-choice-icon",
                  )}
                  <span className="hover-detail" role="tooltip">
                    <strong>{candidate.name[locale]}</strong>
                    <small>{candidate.role[locale]}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
