import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { fetchDeadlockData } from "./api/deadlockApi";
import type {
  AssetIcons,
  Hero,
  Item,
  ItemPropertyTag,
  Locale,
  SelectedItem,
} from "./types";

import { calculateStats, statKeys, statLabels } from "./utils/calculateStats";
import "./styles.css";

type PopoverPosition = {
  left: number;
  top: number;
  maxHeight: number;
  placement: "above" | "below";
};

type PopoverButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: ReactNode;
};

function PopoverButton({ tooltip, ...buttonProps }: PopoverButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>();

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;

    const margin = 12;
    const gap = 10;
    const buttonRect = button.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const spaceAbove = buttonRect.top - margin - gap;
    const spaceBelow = viewportHeight - buttonRect.bottom - margin - gap;
    const placement =
      spaceAbove >= popoverRect.height || spaceAbove >= spaceBelow
        ? "above"
        : "below";
    const halfWidth = popoverRect.width / 2;
    const left = Math.min(
      viewportWidth - margin - halfWidth,
      Math.max(margin + halfWidth, buttonRect.left + buttonRect.width / 2),
    );

    setPosition({
      left,
      top: placement === "above" ? buttonRect.top - gap : buttonRect.bottom + gap,
      maxHeight: Math.max(80, placement === "above" ? spaceAbove : spaceBelow),
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(undefined);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const popoverStyle = position
    ? ({
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxHeight: `${position.maxHeight}px`,
      } satisfies CSSProperties)
    : undefined;

  return (
    <>
      <button
        {...buttonProps}
        ref={buttonRef}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className={`hover-detail ${position?.placement === "below" ? "is-below" : "is-above"}`}
            role="tooltip"
            style={popoverStyle}
          >
            {tooltip}
          </div>,
          document.body,
        )}
    </>
  );
}

const isImageUrl = (value: string) => /^https?:\/\//.test(value);

const renderIcon = (value: string, alt: string, className?: string) =>
  isImageUrl(value) ? (
    <img className={className} src={value} alt={alt} loading="lazy" />
  ) : (
    <span className={className}>{value}</span>
  );

const renderItemPropertyTags = (item: Item, locale: Locale) =>
  item.propertyTags?.length ? (
    <div className="item-property-tags">
      {item.propertyTags.map((property) => (
        <span
          className={`item-property-tag${property.emphasized ? " is-emphasized" : ""}`}
          key={property.id}
        >
          {property.icon && (
            <img className="property-icon" src={property.icon} alt="" />
          )}
          <span>{property.label[locale]}</span>
          <strong>{property.value[locale]}</strong>
          {property.condition?.[locale] && (
            <em>{property.condition[locale]}</em>
          )}
        </span>
      ))}
    </div>
  ) : null;

const itemSlotOrder = ["weapon", "vitality", "spirit"] as const;
const itemTierOrder = [1, 2, 3, 4] as const;

const itemSlotLabels = {
  weapon: { en: "Weapon", ja: "武器" },
  vitality: { en: "Vitality", ja: "耐久" },
  spirit: { en: "Spirit", ja: "スピリット" },
} as const;

const normalizeBonusLabel = (label: string) =>
  label.replace(/\s+/g, "").replace(/／/g, "/");

const bonusSummaryLabels = new Set(
  [
    "武器ダメージ",
    "最大弾数",
    "非戦闘時リジェネ",
    "弾速",
    "近接攻撃耐性",
    "HP増加",
    "ヘッドショット追加ダメージ",
    "発射速度",
    "スピリットパワー",
    "スプリント速度",
    "ダッシュ距離",
    "移動速度",
    "スロウ継続時間",
    "スピリット耐性",
    "スピリットライフスティール",
    "弾薬耐性",
    "スロウ耐性",
    "スライディング距離",
    "スタミナ回復",
    "スタミナ",
    "近接攻撃距離",
    "近接強攻撃距離",
    "近接ダメージ",
    "近接攻撃追加ダメージ",
    "近接強攻撃追加ダメージ",
    "武器マルチショット",
    "弾薬ライフスティール",
    "足音可聴距離",
    "アビリティ範囲",
    "感電ダメージ",
    "デバフ耐性",
    "武器ズーム",
    "ヘッドショット時の回復",
    "ヘッドショット時の回復量",
    "ヘッドショット時のスピリット耐性低下",
    "出血ダメージ",
    "回復阻害",
    "奇襲状態の発射速度",
    "奇襲状態のスピリットパワー",
    "奇襲状態の近接ダメージ",
    "HP吸収",
    "サブ射撃武器ダメージ",
    "ダメージ",
    "スピリットダメージ低下",
    "サイレンス継続時間",
    "追加武器ダメージ",
    "ブロック確率",
    "プロック確率",
    "跳弾対象",
    "跳弾ダメージ",
    "アビリティ継続時間",
    "アビリティクールダウン短縮",
    "近接攻撃時の回復量",
    "パリィクールダウン",
    "バリア",
    "合計HPリジェネ",
    "HPリジェネ",
    "回復効果量",
    "ソウル/分",
    "反射弾薬ダメージ",
    "反射スピリットダメージ",
    "ヒーローキル時の回復",
    "空中ジャンプ/ダッシュ距離",
    "回復量",
    "テレポート距離",
    "空中制御",
    "近接攻撃時の回復",
    "インビジブル継続時間",
    "インビジブル中移動速度",
    "ダメージ低下",
    "最大HPスティール",
    "衝突ダメージ",
    "デス無効継続時間",
    "クールダウン短縮/ヒット",
    "ヒット時効果無効確率",
    "無効確率",
    "アビリティ追加チャージ",
    "発射速度ボーナス",
    "スピリット耐性の吸収量",
    "スピリットパワーの吸収量",
    "パルスダメージ",
    "現在のHPの追加割合ダメージ",
    "現在HPの追加割合ダメージ",
    "エンチャントライフスティール",
    "アイテムクールダウン",
    "アイテム クールダウン短縮",
    "凍結継続時間",
    "爆発ダメージ",
  ].map(normalizeBonusLabel),
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
    calculatedStats: "Build-adjusted stats",
    itemBonuses: "Item bonuses & effects",
    aggregatedBonuses: "Combined bonuses",
    conditionalEffects: "Conditional stat bonuses",
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
    calculatedStats: "ビルド反映ステータス",
    itemBonuses: "アイテムによる上昇項目・付与効果",
    aggregatedBonuses: "合算された上昇項目",
    conditionalEffects: "条件付きステータス効果",
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
  const [assetIcons, setAssetIcons] = useState<AssetIcons>({ categories: {}, stats: {} });
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
      setHeroes(apiHeroes);
      setItems(apiItems);
      setAssetIcons(apiAssets.icons);
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
  const itemSections = useMemo(
    () =>
      itemSlotOrder.flatMap((slotType) =>
        itemTierOrder
          .map((tier) => ({
            slotType,
            tier,
            items: items.filter(
              (item) => item.slotType === slotType && item.tier === tier,
            ),
          }))
          .filter((section) => section.items.length > 0),
      ),
    [items],
  );
  const sortedSelectedItems = useMemo(
    () =>
      selectedItems
        .map((selected, selectionIndex) => ({
          selected,
          selectionIndex,
          item: items.find((candidate) => candidate.id === selected.itemId),
        }))
        .sort((left, right) => {
          const leftSlot = left.item?.slotType
            ? itemSlotOrder.indexOf(left.item.slotType)
            : itemSlotOrder.length;
          const rightSlot = right.item?.slotType
            ? itemSlotOrder.indexOf(right.item.slotType)
            : itemSlotOrder.length;
          return (
            leftSlot - rightSlot ||
            (left.item?.tier ?? Number.MAX_SAFE_INTEGER) -
              (right.item?.tier ?? Number.MAX_SAFE_INTEGER) ||
            left.selectionIndex - right.selectionIndex
          );
        })
        .map(({ selected }) => selected),
    [items, selectedItems],
  );
  const aggregatedItemProperties = useMemo(() => {
    const aggregates = new Map<
      string,
      { property: ItemPropertyTag; total: number; contributors: Item[] }
    >();

    selectedItems.forEach((selected) => {
      const item = items.find((candidate) => candidate.id === selected.itemId);
      item?.propertyTags?.forEach((property) => {
        // Hover shows every API tag; the build summary follows the explicit
        // allowlist supplied for the "Combined bonuses" section.
        if (!bonusSummaryLabels.has(normalizeBonusLabel(property.label.ja))) return;
        if (property.numericValue == null) return;
        if (
          property.activationEffectId &&
          !selected.enabledEffectIds.includes(property.activationEffectId)
        ) {
          return;
        }
        const key = [
          property.id,
          property.unit?.en ?? "",
          property.condition?.en ?? "",
        ].join("|");
        const current = aggregates.get(key);
        if (current) {
          current.total += property.numericValue;
          if (!current.contributors.some((contributor) => contributor.id === item.id)) {
            current.contributors.push(item);
          }
        } else {
          aggregates.set(key, {
            property,
            total: property.numericValue,
            contributors: [item],
          });
        }
      });
    });

    return [...aggregates.values()];
  }, [items, selectedItems]);
  const conditionalStatEffects = useMemo(
    () =>
      selectedItems.flatMap((selected) => {
        const item = items.find((candidate) => candidate.id === selected.itemId);
        return item
          ? item.effects
              .filter(
                (effect) =>
                  effect.conditional &&
                  item.propertyTags?.some(
                    (property) =>
                      property.activationEffectId === effect.id &&
                      bonusSummaryLabels.has(
                        normalizeBonusLabel(property.label.ja),
                      ),
                  ),
              )
              .map((effect) => ({ selected, item, effect }))
          : [];
      }),
    [items, selectedItems],
  );

  const formatHeroDetails = (candidate: Hero) =>
    [candidate.name[locale], candidate.role[locale]]
      .filter(Boolean)
      .join(" / ");

  const formatItemDetails = (item: Item) =>
    `${item.name[locale]} / ${item.category[locale]} / ${t.price}: ${item.price}`;

  const toggleItem = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    setSelectedItems((current) => {
      if (current.some((selected) => selected.itemId === itemId)) {
        return current.filter((selected) => selected.itemId !== itemId);
      }
      if (current.length >= 12) return current;
      return [
        ...current,
        {
          instanceId: crypto.randomUUID(),
          itemId,
          enabledEffectIds:
            item?.effects
              .filter((effect) => effect.defaultEnabled)
              .map((effect) => effect.id) ?? [],
        },
      ];
    });
  };

  const formatAggregatedValue = (
    total: number,
    property: ItemPropertyTag,
  ) => {
    const normalized = Number(total.toFixed(6));
    const sign = normalized > 0 ? "+" : "";
    return `${sign}${normalized}${property.unit?.[locale] ?? ""}`;
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
          <PopoverButton
            className="hero-button icon-only-card"
            onClick={() => setHeroModalOpen(true)}
            aria-label={`${t.selectHero}: ${hero.name[locale]}`}
            tooltip={
              <>
                <strong>{hero.name[locale]}</strong>
                <small>{hero.role[locale]}</small>
              </>
            }
          >
            {renderIcon(hero.icon, hero.name[locale], "hero-icon")}
          </PopoverButton>
          <label className="level-control">
            {t.level}
            <input
              type="number"
              min="1"
              max="36"
              value={level}
              onChange={(event) =>
                setLevel(Math.min(36, Math.max(1, Number(event.target.value))))
              }
            />
          </label>
        </header>
        <div>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="item-sections" aria-label={t.items}>
          {itemSections.map((section) => (
            <section
              className="item-section"
              data-slot={section.slotType}
              key={`${section.slotType}-${section.tier}`}
            >
              <h2 className="item-section-heading">
                {assetIcons.categories[section.slotType] && (
                  <img
                    src={assetIcons.categories[section.slotType]}
                    alt=""
                  />
                )}
                {itemSlotLabels[section.slotType][locale]} · Tier {section.tier}
                <small>{section.items.length}</small>
              </h2>
              <div className="item-grid">
                {section.items.map((item) => (
                  <PopoverButton
                    className={`item-card icon-only-card${selectedItems.some((selected) => selected.itemId === item.id) ? " is-selected" : ""}`}
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    aria-label={formatItemDetails(item)}
                    aria-pressed={selectedItems.some(
                      (selected) => selected.itemId === item.id,
                    )}
                    tooltip={
                      <>
                        <strong>{item.name[locale]}</strong>
                        <small>
                          {item.slotType && assetIcons.categories[item.slotType] && (
                            <img
                              className="inline-icon"
                              src={assetIcons.categories[item.slotType]}
                              alt=""
                            />
                          )}
                          {item.category[locale]} · {assetIcons.price && (
                            <img className="inline-icon" src={assetIcons.price} alt="" />
                          )}{item.price}
                        </small>
                        {renderItemPropertyTags(item, locale)}
                        {item.description?.[locale] && (
                          <p className="item-description">
                            {item.description[locale]}
                          </p>
                        )}
                      </>
                    }
                  >
                    {renderIcon(item.icon, item.name[locale], "item-icon")}
                  </PopoverButton>
                ))}
              </div>
            </section>
          ))}
        </div>
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
          {Array.from({ length: 12 }, (_, index) => {
            const selected = sortedSelectedItems[index];
            if (!selected) {
              return (
                <div
                  className="build-item build-slot-empty"
                  key={`empty-${index}`}
                  aria-hidden="true"
                >
                  <span>{index + 1}</span>
                </div>
              );
            }

              const item = items.find(
                (candidate) => candidate.id === selected.itemId,
              );
              if (!item) return null;
              return (
                <button
                  type="button"
                  className="build-item"
                  key={selected.instanceId}
                  title={item.name[locale]}
                  aria-label={`${item.name[locale]} - remove`}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="build-item-main">
                    {renderIcon(
                      item.icon,
                      item.name[locale],
                      "build-item-icon",
                    )}
                    <strong>{item.name[locale]}</strong>
                  </div>
                </button>
              );
            })}
        </section>

        <section className="stats-panel">
          <h2>{t.stats}</h2>
          <div className="calculated-stat-group">
            <h3>{t.calculatedStats}</h3>
            <div className="calculated-stat-grid">
              {statKeys.map((key) => (
                <div className="stat-row" key={key}>
                  <span className="stat-label">
                    {assetIcons.stats[key] && (
                      <img className="stat-icon" src={assetIcons.stats[key]} alt="" />
                    )}
                    {statLabels[key][locale]}
                  </span>
                  <strong>
                    {Number.isInteger(stats[key])
                      ? stats[key]
                      : stats[key].toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <section className="item-effects-summary">
            <h3>{t.itemBonuses}</h3>
            {aggregatedItemProperties.length > 0 && (
              <div className="aggregated-bonuses">
                <h4>{t.aggregatedBonuses}</h4>
                <div className="aggregated-bonus-list">
                  {aggregatedItemProperties.map(
                    ({ property, total, contributors }) => (
                      <div
                        className={`aggregated-bonus${property.emphasized ? " is-emphasized" : ""}`}
                        key={`${property.id}-${property.unit?.en ?? ""}-${property.condition?.en ?? ""}`}
                      >
                        <span>
                          {property.icon && (
                            <img src={property.icon} alt="" />
                          )}
                          {property.label[locale]}
                          <span className="contributor-icons">
                            {contributors.map((contributor) => (
                              <span
                                key={contributor.id}
                                title={contributor.name[locale]}
                              >
                                {renderIcon(
                                  contributor.icon,
                                  "",
                                  "contributor-icon",
                                )}
                              </span>
                            ))}
                          </span>
                          {property.condition?.[locale] && (
                            <small>{property.condition[locale]}</small>
                          )}
                        </span>
                        <strong>
                          {formatAggregatedValue(total, property)}
                        </strong>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
            {conditionalStatEffects.length > 0 && (
              <div className="conditional-effects">
                <h4>{t.conditionalEffects}</h4>
                {conditionalStatEffects.map(({ selected, item, effect }) => (
                  <label
                    className="conditional-effect-control"
                    key={`${selected.instanceId}-${effect.id}`}
                  >
                    <span>
                      <strong>{item.name[locale]}</strong>
                      {renderIcon(
                        item.icon,
                        item.name[locale],
                        "effect-item-icon",
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={selected.enabledEffectIds.includes(effect.id)}
                      onChange={() => toggleEffect(selected.instanceId, effect.id)}
                    />
                    {effect.name[locale]}
                  </label>
                ))}
              </div>
            )}
          </section>
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
                <PopoverButton
                  className="hero-choice icon-only-card"
                  key={candidate.id}
                  onClick={() => {
                    setHeroId(candidate.id);
                    setHeroModalOpen(false);
                  }}
                  aria-label={formatHeroDetails(candidate)}
                  tooltip={
                    <>
                      <strong>{candidate.name[locale]}</strong>
                      <small>{candidate.role[locale]}</small>
                    </>
                  }
                >
                  {renderIcon(
                    candidate.icon,
                    candidate.name[locale],
                    "hero-choice-icon",
                  )}
                </PopoverButton>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
