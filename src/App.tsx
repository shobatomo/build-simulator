"use client";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type CSSProperties,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { fetchDeadlockData } from "./api/deadlockApi";
import type {
    AssetIcons,
    Hero,
    Item,
    ItemPropertyTag,
    Locale,
} from "./types";

import { calculateStats, statKeys, statLabels } from "./utils/calculateStats";
import { indexItemUpgrades } from "./domain/itemUpgrades";
import { toggleBuildItem, type ItemSelectionState } from "./domain/itemSelection";

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
    const tooltipId = useId();
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
            Math.max(
                margin + halfWidth,
                buttonRect.left + buttonRect.width / 2,
            ),
        );

        setPosition({
            left,
            top:
                placement === "above"
                    ? buttonRect.top - gap
                    : buttonRect.bottom + gap,
            maxHeight: Math.max(
                80,
                placement === "above" ? spaceAbove : spaceBelow,
            ),
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
                aria-describedby={isOpen ? tooltipId : undefined}
                onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) setIsOpen(true); }}
                onMouseLeave={() => setIsOpen(false)}
                onFocus={(event) => setIsOpen(event.currentTarget.matches(":focus-visible"))}
                onPointerDown={(event) => { if (event.pointerType === "touch") setIsOpen(false); }}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && isOpen) { event.stopPropagation(); setIsOpen(false); }
                    buttonProps.onKeyDown?.(event);
                }}
                onBlur={() => setIsOpen(false)}
            />
            {isOpen &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className={`hover-detail ${position?.placement === "below" ? "is-below" : "is-above"}`}
                        id={tooltipId}
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


function Modal({ title, closeLabel, onClose, children }: {
    title: string;
    closeLabel: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        dialog?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus({ preventScroll: true });
        };
    }, []);
    return (
        <dialog ref={ref} className="modal" aria-labelledby={titleId}
            onCancel={(event) => { event.preventDefault(); onClose(); }}
            onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
                ));
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault(); last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first?.focus();
                }
            }}
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="modal-heading">
                <h2 id={titleId}>{title}</h2>
                <button type="button" onClick={onClose} aria-label={closeLabel}><X aria-hidden="true" /></button>
            </div>
            <div className="modal-content">{children}</div>
        </dialog>
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
                        <img
                            className="property-icon"
                            src={property.icon}
                            alt=""
                        />
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

const getItemEffectType = (item: Item, locale: Locale) => {
    const effect = item.effects[0];
    if (!effect) return undefined;

    const effectName = `${effect.name.en} ${effect.name.ja}`.toLowerCase();
    const type =
        effectName.includes("active") || effectName.includes("アクティブ")
            ? "active"
            : effect.conditional
              ? "conditional"
              : "passive";
    const labels = {
        active: { en: "Active", ja: "アクティブ" },
        passive: { en: "Passive", ja: "パッシブ" },
        conditional: { en: "Conditional", ja: "条件付き" },
    } as const;

    return labels[type][locale];
};

const itemSlotOrder = ["weapon", "vitality", "spirit"] as const;
const itemTierOrder = [1, 2, 3, 4] as const;

const itemSlotLabels = {
    weapon: { en: "Weapon", ja: "武器" },
    vitality: { en: "Vitality", ja: "バイタリティ" },
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
        eyebrow: "DEADLOCK // BUILD SIMULATOR",
        title: "Build Simulator",
        subtitle:
            "Select a hero, boon, and items to review updated attributes and item effects.",
        helper: "",
        pills: [],
        level: "Boon (Level)",
        items: "Items",
        build: "Selected Build",
        stats: "Hero Attributes",
        calculatedStats: "With Build Applied",
        itemBonuses: "Item Effects",
        aggregatedBonuses: "Combined Item Bonuses",
        conditionalEffects: "Conditional Effects",
        selectHero: "Select Hero",
        conditional: "Conditional effects",
        empty: "Select items to display your build here.",
        lang: "日本語",
        loading: "Loading Deadlock data…",
        error: "Unable to load data.",
        retry: "Reload",
        price: "Cost",
    },
    ja: {
        eyebrow: "DEADLOCK // ビルドシミュレーター",
        title: "ビルドシミュレーター",
        subtitle:
            "ヒーロー、ブーン、アイテムを選択し、変化する属性とアイテム効果を確認できます。",
        helper: "",
        pills: [],
        level: "ブーン（レベル）",
        items: "アイテム",
        build: "選択中のビルド",
        stats: "ヒーロー属性",
        calculatedStats: "ビルド適用後",
        itemBonuses: "アイテム効果",
        aggregatedBonuses: "アイテムボーナス合計",
        conditionalEffects: "条件付き効果",
        selectHero: "ヒーローを選択",
        conditional: "条件付き効果",
        empty: "アイテムを選択すると、ここにビルドが表示されます。",
        lang: "English",
        loading: "Deadlockデータを読み込んでいます…",
        error: "データを読み込めませんでした。",
        retry: "再読み込み",
        price: "コスト",
    },
};

export default function App() {
    const [locale, setLocale] = useState<Locale>("ja");
    const [heroes, setHeroes] = useState<Hero[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [assetIcons, setAssetIcons] = useState<AssetIcons>({
        categories: {},
        stats: {},
    });
    const [heroId, setHeroId] = useState<string>();
    const [level, setLevel] = useState(1);
    const [isHeroModalOpen, setHeroModalOpen] = useState(false);
    const [inspectedItemId, setInspectedItemId] = useState<string>();
    const itemBrowsePosition = useRef<number | null>(null);
    const itemBrowseControl = useRef<HTMLElement | null>(null);
    const [selection, setSelection] = useState<ItemSelectionState>({ items: [], notice: null });
    const selectedItems = selection.items;
    const [isLoading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const t = copy[locale];
    const upgradeIndex = useMemo(() => indexItemUpgrades(items), [items]);

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
            setSelection((current) => ({
                items: current.items.filter((selected) =>
                    apiItems.some((item) => item.id === selected.itemId),
                ),
                notice: null,
            }));
        } catch (caughtError) {
            setError(
                caughtError instanceof Error ? caughtError.message : t.error,
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadBuildData();
    }, []);

    useEffect(() => { document.documentElement.lang = locale; }, [locale]);

    const hero = heroes.find((candidate) => candidate.id === heroId);
    const stats = useMemo(
        () =>
            hero
                ? calculateStats(hero, level, selectedItems, items)
                : undefined,
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
                            (item) =>
                                item.slotType === slotType &&
                                item.tier === tier,
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
                    item: items.find(
                        (candidate) => candidate.id === selected.itemId,
                    ),
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
            const item = items.find(
                (candidate) => candidate.id === selected.itemId,
            );
            item?.propertyTags?.forEach((property) => {
                // Hover shows every API tag; the build summary follows the explicit
                // allowlist supplied for the "Combined bonuses" section.
                if (
                    !bonusSummaryLabels.has(
                        normalizeBonusLabel(property.label.ja),
                    )
                )
                    return;
                if (property.numericValue == null) return;
                if (
                    property.activationEffectId &&
                    !selected.enabledEffectIds.includes(
                        property.activationEffectId,
                    )
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
                    if (
                        !current.contributors.some(
                            (contributor) => contributor.id === item.id,
                        )
                    ) {
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
                const item = items.find(
                    (candidate) => candidate.id === selected.itemId,
                );
                return item
                    ? item.effects
                          .filter(
                              (effect) =>
                                  effect.conditional &&
                                  item.propertyTags?.some(
                                      (property) =>
                                          property.activationEffectId ===
                                              effect.id &&
                                          bonusSummaryLabels.has(
                                              normalizeBonusLabel(
                                                  property.label.ja,
                                              ),
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

    const inspectedItem = items.find((item) => item.id === inspectedItemId);

    const formatItemDetails = (item: Item) =>
        `${item.name[locale]} / ${item.category[locale]} / ${t.price}: ${item.price}`;

    const toggleItem = (itemId: string) => {
        const instanceId = crypto.randomUUID();
        setSelection((current) => toggleBuildItem(current, itemId, upgradeIndex, instanceId));
    };

    const itemNames = (ids: string[]) => ids.map((id) => upgradeIndex.byId.get(id)?.name[locale] ?? id).join(" / ");
    const selectionMessage = (() => {
        const notice = selection.notice;
        if (!notice) return "";
        const name = itemNames([notice.itemId]);
        const related = itemNames(notice.relatedIds);
        if (notice.kind === "blocked-upgrade") return locale === "ja"
            ? `${related} を選択中のため、構成元 ${name} は追加できません。`
            : `Cannot add ${name}: its upgrade ${related} is already selected.`;
        if (notice.kind === "full") return locale === "ja" ? "アイテムは12枠までです。追加するには選択を解除してください。" : "All 12 slots are occupied. Remove an item before adding another.";
        if (notice.kind === "invalid-item") return locale === "ja" ? "アイテムの識別情報または構成関係に問題があるため追加できません。" : "This item's identity or component relationships are invalid; it cannot be added.";
        if (notice.kind === "replaced") return locale === "ja" ? `${name} を選択し、構成元 ${related} を解除しました。` : `Selected ${name} and removed its components: ${related}.`;
        return locale === "ja" ? `${name} ${notice.kind === "added" ? "を選択しました。" : "を解除しました。"}` : `${notice.kind === "added" ? "Selected" : "Removed"} ${name}.`;
    })();

    const formatAggregatedValue = (
        total: number,
        property: ItemPropertyTag,
    ) => {
        const normalized = Number(total.toFixed(6));
        const sign = normalized > 0 ? "+" : "";
        return `${sign}${normalized}${property.unit?.[locale] ?? ""}`;
    };

    const toggleEffect = (instanceId: string, effectId: string) => {
        setSelection((current) => ({ ...current,
            items: current.items.map((selected) =>
                selected.instanceId !== instanceId
                    ? selected
                    : {
                          ...selected,
                          enabledEffectIds: selected.enabledEffectIds.includes(
                              effectId,
                          )
                              ? selected.enabledEffectIds.filter(
                                    (id) => id !== effectId,
                                )
                              : [...selected.enabledEffectIds, effectId],
                      },
            ),
        }));
    };
    const renderItemDetails = (item: Item) => (
<>
                                                <strong>
                                                    {item.name[locale]}
                                                </strong>
                                                {item.upgradeRelations?.componentIds.length ? <small>{locale === "ja" ? "構成元" : "Components"}: {itemNames(item.upgradeRelations.componentIds)}</small> : null}
                                                {upgradeIndex.directUpgradesByComponentId.get(item.id)?.size ? <small>{locale === "ja" ? "アップグレード先" : "Upgrades to"}: {itemNames([...upgradeIndex.directUpgradesByComponentId.get(item.id)!])}</small> : null}
                                                {!item.upgradeRelations || item.upgradeRelations.status === "unresolved" ? <small>{locale === "ja" ? "構成関係の一部または全部が未確認です。" : "Some or all component relationships are unverified."}</small> : null}
                                                <small>
                                                    {item.slotType &&
                                                        assetIcons.categories[
                                                            item.slotType
                                                        ] && (
                                                            <img
                                                                className="inline-icon"
                                                                src={
                                                                    assetIcons
                                                                        .categories[
                                                                        item
                                                                            .slotType
                                                                    ]
                                                                }
                                                                alt=""
                                                            />
                                                        )}
                                                    {item.category[locale]} ·{" "}
                                                    {assetIcons.price && (
                                                        <img
                                                            className="inline-icon"
                                                            src={
                                                                assetIcons.price
                                                            }
                                                            alt=""
                                                        />
                                                    )}
                                                    {item.price}
                                                </small>
                                                {getItemEffectType(
                                                    item,
                                                    locale,
                                                ) && (
                                                    <span className="item-effect-type">
                                                        {getItemEffectType(
                                                            item,
                                                            locale,
                                                        )}
                                                    </span>
                                                )}
                                                {renderItemPropertyTags(
                                                    item,
                                                    locale,
                                                )}
                                                {item.description?.[locale] && (
                                                    <p className="item-description">
                                                        {
                                                            item.description[
                                                                locale
                                                            ]
                                                        }
                                                    </p>
                                                )}
                                            </>
    );
    const goToBuild = () => {
        const build = document.getElementById("build-panel");
        if (build && build.getBoundingClientRect().top > 100) {
            itemBrowsePosition.current = window.scrollY;
        }
        build?.focus({ preventScroll: true });
        build?.scrollIntoView({ block: "start" });
    };
    const goToItems = () => {
        const target = itemBrowseControl.current ?? document.getElementById("items-panel");
        target?.focus({ preventScroll: true });
        if (itemBrowsePosition.current !== null) window.scrollTo({ top: itemBrowsePosition.current });
        else target?.scrollIntoView({ block: "start" });
    };
    const pageHeader = (
        <header className="page-header">
            <span className="site-brand">DEADLOCK <small>BUILD SIMULATOR</small></span>
            <button type="button" className="language-toggle" lang={locale === "ja" ? "en" : "ja"}
                aria-label={locale === "ja" ? "Switch language to English" : "言語を日本語に切り替える"}
                onClick={() => setLocale((current) => current === "ja" ? "en" : "ja")}>
                {t.lang}
            </button>
        </header>
    );
    if (isLoading) {
        return (
            <>{pageHeader}<main className="status-screen" aria-busy="true">
                <p role="status">{t.loading}</p>
            </main></>
        );
    }

    if (error || !hero || !stats) {
        return (
            <>{pageHeader}<main className="status-screen">
                <p>{t.error}</p>
                <small>{error}</small>
                <button
                    className="language-toggle"
                    onClick={() => void loadBuildData()}
                >
                    {t.retry}
                </button>
            </main></>
        );
    }

    return (
        <>{pageHeader}<main className="app-shell">
            <section className="left-panel">
                <header className="top-bar">
                    <div className="hero-selector">
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
                            {renderIcon(
                                hero.icon,
                                hero.name[locale],
                                "hero-icon",
                            )}
                        </PopoverButton>
                        <button
                            className="hero-selector-copy"
                            type="button"
                            onClick={() => setHeroModalOpen(true)}
                            aria-label={`${t.selectHero}: ${hero.name[locale]}`}
                        >
                            <span>{t.selectHero}</span>
                            <strong>{hero.name[locale]}</strong>
                        </button>
                    </div>
                    <label className="level-control">
                        {t.level}
                        <input
                            type="number"
                            min="1"
                            max="36"
                            value={level}
                            onChange={(event) =>
                                setLevel(
                                    Math.min(
                                        36,
                                        Math.max(1, Number(event.target.value)),
                                    ),
                                )
                            }
                        />
                    </label>
                </header>
                <div className="intro-card">
                    <p className="eyebrow">{t.eyebrow}</p>
                    <h1>{t.title}</h1>
                    {t.subtitle && <p className="subtitle">{t.subtitle}</p>}
                    {t.helper && <p className="intro-helper">{t.helper}</p>}
                    <p className="intro-helper"><Link href="/combat">{locale === "ja" ? "Bebop コンボ試算（試験版）を開く →" : "Open Bebop Combo Lab (Experimental · Japanese) →"}</Link></p>
                    {t.pills.length > 0 && (
                        <div className="intro-pills" aria-label={t.items}>
                            {t.pills.map((pill) => (
                                <span key={pill}>{pill}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="selection-feedback" role="status" aria-live="polite" aria-atomic="true">
                    {selectionMessage}
                </div>
                {(upgradeIndex.unavailableIds.length > 0 || upgradeIndex.diagnostics.length > 0) && (
                    <details className="upgrade-diagnostics">
                        <summary>{locale === "ja" ? "一部の構成関係を確認できません" : "Some component relationships are unavailable"}</summary>
                        <p>{locale === "ja" ? "確認できた関係だけを自動解除に使います。関係のない旧保存データや未解決の参照から、名前で構成元を推測することはありません。" : "Only confirmed relationships trigger automatic removal. Missing legacy data and unresolved references are never inferred from item names."}</p>
                        {upgradeIndex.unavailableIds.length > 0 && <p>{locale === "ja" ? "構成関係のない保存アイテム" : "Items without relationship metadata"}: {upgradeIndex.unavailableIds.length}</p>}
                        <ul>{upgradeIndex.diagnostics.map((issue, index) => <li key={`${issue.itemId}-${issue.code}-${index}`}>{itemNames([issue.itemId])}: {issue.code}{issue.reference ? ` (${issue.reference})` : ""}</li>)}</ul>
                    </details>
                )}
                <section className="mobile-build-summary" aria-label={t.build}>
                    <div className="mobile-summary-heading">
                        <h2>{t.build}</h2>
                        <button type="button" className="summary-link" onClick={goToBuild}>{locale === "ja" ? "すべての属性" : "All attributes"} →</button>
                    </div>
                    <div className="mobile-selected-items">
                        {sortedSelectedItems.length > 0 ? (
                            sortedSelectedItems.map((selected) => {
                                const selectedItem = items.find(
                                    (item) => item.id === selected.itemId,
                                );
                                return selectedItem ? (
                                    <span
                                        key={selected.instanceId}
                                        title={selectedItem.name[locale]}
                                    >
                                        {renderIcon(
                                            selectedItem.icon,
                                            selectedItem.name[locale],
                                            "build-item-icon",
                                        )}
                                    </span>
                                ) : null;
                            })
                        ) : (
                            <small>{t.empty}</small>
                        )}
                    </div>
                    <div className="mobile-stat-grid">
                        {statKeys.slice(0, 4).map((key) => (
                            <div className="stat-row" key={key}>
                                <span className="stat-label">
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
                </section>
                <div className="item-sections" id="items-panel" tabIndex={-1} aria-label={t.items}
                    onFocusCapture={(event) => { if (event.target instanceof HTMLButtonElement) itemBrowseControl.current = event.target; }}>
                    <p className="item-help">{locale === "ja" ? "アイコンで選択・解除。「詳細」で効果を確認できます。" : "Tap an icon to add or remove. Open Details to read its effects."}</p>
                    {itemSections.map((section) => (
                        <section
                            className="item-section"
                            data-slot={section.slotType}
                            key={`${section.slotType}-${section.tier}`}
                        >
                            <h2 className="item-section-heading">
                                {assetIcons.categories[section.slotType] && (
                                    <img
                                        src={
                                            assetIcons.categories[
                                                section.slotType
                                            ]
                                        }
                                        alt=""
                                    />
                                )}
                                {itemSlotLabels[section.slotType][locale]} ·{" "}
                                {locale === "ja" ? "ティア" : "Tier"}{" "}
                                {section.tier}
                                <small>{section.items.length}</small>
                            </h2>
                            <div className="item-grid">
                                {section.items.map((item) => (
                                    <div className="item-tile" key={item.id}>
                                    <PopoverButton
                                        className={`item-card icon-only-card${selectedItems.some((selected) => selected.itemId === item.id) ? " is-selected" : ""}`}
                                        onClick={() => toggleItem(item.id)}
                                        aria-label={formatItemDetails(item)}
                                        aria-pressed={selectedItems.some(
                                            (selected) =>
                                                selected.itemId === item.id,
                                        )}
                                        tooltip={renderItemDetails(item)}
                                    >
                                        {renderIcon(
                                            item.icon,
                                            item.name[locale],
                                            "item-icon",
                                        )}
                                        <span className="item-card-name">{item.name[locale]}</span>
                                        <span className="item-selected-mark" aria-hidden="true">✓</span>
                                    </PopoverButton>
                                    <button type="button" className="item-detail-button"
                                        aria-label={`${locale === "ja" ? "詳細" : "Details"}: ${item.name[locale]}`}
                                        aria-haspopup="dialog" onClick={() => setInspectedItemId(item.id)}>
                                        {locale === "ja" ? "詳細" : "Details"}
                                    </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </section>
            <section className="right-panel" id="build-panel" tabIndex={-1} aria-label={t.build}>
                <div className="right-header">
                    <h2>{t.build}</h2>
                    <small>{selectedItems.length}/12</small>
                </div>
                <p className="build-help">{locale === "ja" ? "選択済みのアイテムを押すと解除できます。" : "Select an equipped item to remove it."}</p>
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
                                aria-label={`${item.name[locale]} - ${locale === "ja" ? "解除" : "remove"}`}
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
                                            <img
                                                className="stat-icon"
                                                src={assetIcons.stats[key]}
                                                alt=""
                                            />
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
                                                        <img
                                                            src={property.icon}
                                                            alt=""
                                                        />
                                                    )}
                                                    {property.label[locale]}
                                                    <span className="contributor-icons">
                                                        {contributors.map(
                                                            (contributor) => (
                                                                <span
                                                                    key={
                                                                        contributor.id
                                                                    }
                                                                    title={
                                                                        contributor
                                                                            .name[
                                                                            locale
                                                                        ]
                                                                    }
                                                                >
                                                                    {renderIcon(
                                                                        contributor.icon,
                                                                        "",
                                                                        "contributor-icon",
                                                                    )}
                                                                </span>
                                                            ),
                                                        )}
                                                    </span>
                                                    {property.condition?.[
                                                        locale
                                                    ] && (
                                                        <small>
                                                            {
                                                                property
                                                                    .condition[
                                                                    locale
                                                                ]
                                                            }
                                                        </small>
                                                    )}
                                                </span>
                                                <strong>
                                                    {formatAggregatedValue(
                                                        total,
                                                        property,
                                                    )}
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
                                {conditionalStatEffects.map(
                                    ({ selected, item, effect }) => (
                                        <label
                                            className="conditional-effect-control"
                                            key={`${selected.instanceId}-${effect.id}`}
                                        >
                                            <span>
                                                <strong>
                                                    {item.name[locale]}
                                                </strong>
                                                {renderIcon(
                                                    item.icon,
                                                    item.name[locale],
                                                    "effect-item-icon",
                                                )}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={selected.enabledEffectIds.includes(
                                                    effect.id,
                                                )}
                                                onChange={() =>
                                                    toggleEffect(
                                                        selected.instanceId,
                                                        effect.id,
                                                    )
                                                }
                                            />
                                            {effect.name[locale]}
                                        </label>
                                    ),
                                )}
                            </div>
                        )}
                    </section>
                </section>
            </section>
            <nav className="mobile-navigation" aria-label={locale === "ja" ? "ページ内移動" : "Page sections"}>
                <button type="button" onClick={goToItems} aria-controls="items-panel">{t.items}</button>
                <button type="button" onClick={goToBuild} aria-controls="build-panel">{locale === "ja" ? "ビルド・属性" : "Build & attributes"} <span>{selectedItems.length}/12</span></button>
            </nav>
            {inspectedItem && (
                <Modal title={inspectedItem.name[locale]} closeLabel={locale === "ja" ? "閉じる" : "Close"} onClose={() => setInspectedItemId(undefined)}>
                    <div className="item-detail-content">{renderItemDetails(inspectedItem)}</div>
                    <button type="button" className="detail-select-button" onClick={() => toggleItem(inspectedItem.id)}
                        aria-pressed={selectedItems.some((selected) => selected.itemId === inspectedItem.id)}>
                        {selectedItems.some((selected) => selected.itemId === inspectedItem.id)
                            ? (locale === "ja" ? "ビルドから解除" : "Remove from build")
                            : (locale === "ja" ? "ビルドに追加" : "Add to build")}
                    </button>
                    <p className="detail-feedback" role="status">{selection.notice?.itemId === inspectedItem.id ? selectionMessage : ""}</p>
                </Modal>
            )}
            {isHeroModalOpen && (
                <Modal title={t.selectHero} closeLabel={locale === "ja" ? "閉じる" : "Close"} onClose={() => setHeroModalOpen(false)}>
                        <div className="hero-choice-grid">
                            {heroes.map((candidate) => (
                                <button
                                    className={`hero-choice icon-only-card${candidate.id === heroId ? " is-selected" : ""}`}
                                    aria-pressed={candidate.id === heroId}
                                    key={candidate.id}
                                    onClick={() => {
                                        setHeroId(candidate.id);
                                        setHeroModalOpen(false);
                                    }}
                                    aria-label={formatHeroDetails(candidate)}
                                >
                                    {renderIcon(
                                        candidate.icon,
                                        candidate.name[locale],
                                        "hero-choice-icon",
                                    )}
                                    <span className="hero-choice-name">{candidate.name[locale]}</span>
                                    {candidate.role[locale] && <small className="hero-choice-role">{candidate.role[locale]}</small>}
                                </button>
                            ))}
                        </div>
                </Modal>
            )}
        </main></>
    );
}
