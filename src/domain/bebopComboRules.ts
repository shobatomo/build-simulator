// Pinned public community-parsed assets; not a Valve API. See docs/bebop-combo.md.
export const COMBO_RULES = {
  "clientVersion": 6819,
  "projectionVersion": "combo-projection-v1",
  "sourceHash": "22061dd319afb63b99e786c10dea1e15b3b9a04646d309f8c14f583f9551b14f",
  "buildTimestamp": "2026-10-22T16:40:35",
  "retrievedAt": "2026-10-26T09:42:52.450Z",
  "hero": {
    "id": "15",
    "className": "hero_bebop",
    "name": "Bebop",
    "image": "https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/bebop_card.webp",
    "health": 880,
    "lightMelee": 63,
    "growth": {
      "health": 52,
      "shot": 0.115,
      "spirit": 1.1,
      "lightMelee": 1.58,
      "bulletResistance": 0.3
    }
  },
  "weapon": {
    "id": "3764085067",
    "damage": 4.98,
    "cycle": 0.084,
    "ammo": 66,
    "reload": 2.35,
    "windup": 0.3,
    "fastWindup": 0.05
  },
  "uppercut": {
    "id": "3089858203",
    "AbilityCooldown": 22,
    "BuffBaseWeaponPct": 0,
    "UppercutBuffOnHit": 0,
    "meleeScale": 1,
    "cooldownUpgrade": -11,
    "buffPercent": 30,
    "buffSeconds": 9
  },
  "bomb": {
    "id": "2521902222",
    "Damage": 85,
    "AbilityCooldown": 18,
    "FuseTime": 3.5,
    "spiritScale": 1.5,
    "damageUpgrade": 85,
    "cooldownUpgrade": -8
  },
  "hook": {
    "id": "1928108461",
    "AbilityCooldown": 23,
    "AbilityCastDelay": 0.1,
    "AbilityPostCastDuration": 0.2,
    "HookImpactDelay": 0.5,
    "meleeScale": 0.7,
    "bulletAmpPercent": 20,
    "bulletAmpSeconds": 6,
    "cooldownUpgrade": -11.5
  },
  "beam": {
    "id": "3832675871",
    "DPS": 160,
    "AbilityCooldown": 120,
    "AbilityCastDelay": 1,
    "AbilityChannelTime": 11,
    "Interval": 0.1,
    "spiritScale": 2.511,
    "damageUpgrade": 108,
    "cooldownUpgrade": -20
  },
  "items": [
    {
      "id": "3633614685",
      "className": "upgrade_health",
      "name": "Extra Health",
      "cost": 800,
      "components": [],
      "health": 210,
      "spirit": 0,
      "bullet": null,
      "spiritResist": null,
      "threshold": null,
      "belowBonus": null
    },
    {
      "id": "968099481",
      "className": "upgrade_improved_spirit",
      "name": "Extra Spirit",
      "cost": 800,
      "components": [],
      "health": null,
      "spirit": 10,
      "bullet": null,
      "spiritResist": null,
      "threshold": null,
      "belowBonus": null
    },
    {
      "id": "7409189",
      "className": "upgrade_soaring_spirit",
      "name": "Improved Spirit",
      "cost": 1600,
      "components": [
        "upgrade_improved_spirit"
      ],
      "health": 75,
      "spirit": 18,
      "bullet": null,
      "spiritResist": null,
      "threshold": null,
      "belowBonus": null
    },
    {
      "id": "3140772621",
      "className": "upgrade_improved_bullet_armor",
      "name": "Bullet Resilience",
      "cost": 3200,
      "components": [],
      "health": null,
      "spirit": 0,
      "bullet": 30,
      "spiritResist": null,
      "threshold": 50,
      "belowBonus": 15
    },
    {
      "id": "2163598980",
      "className": "upgrade_tech_purge",
      "name": "Spirit Resilience",
      "cost": 3200,
      "components": [],
      "health": null,
      "spirit": 0,
      "bullet": null,
      "spiritResist": 30,
      "threshold": 50,
      "belowBonus": 15
    }
  ]
} as const;
