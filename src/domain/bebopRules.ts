// Reviewed mechanical fields from the public 6819 capture. See docs/internal-assets-and-combat.md.
// Exact comparison intentionally refuses changed or new mechanics until reviewed.
import type { JsonObject } from './assets/types';
export const BEBOP_RULES: { clientVersion: number; normalizerVersion: string; hero: JsonObject; items: Record<string, JsonObject>; propertyPresentationKeys: string[]; itemPresentationKeys: string[]; heroKeys: string[] } = {
  "clientVersion": 6819,
  "normalizerVersion": "0.2.0",
  "hero": {
    "id": 15,
    "class_name": "hero_bebop",
    "starting_stats": {
      "max_move_speed": {
        "value": 6.45,
        "display_stat_name": "EMaxMoveSpeed"
      },
      "sprint_speed": {
        "value": 4,
        "display_stat_name": "ESprintSpeed"
      },
      "crouch_speed": {
        "value": 4.75,
        "display_stat_name": "ECrouchSpeed"
      },
      "move_acceleration": {
        "value": 4,
        "display_stat_name": "EMoveAcceleration"
      },
      "light_melee_damage": {
        "value": 63,
        "display_stat_name": "ELightMeleeDamage"
      },
      "heavy_melee_damage": {
        "value": 116,
        "display_stat_name": "EHeavyMeleeDamage"
      },
      "max_health": {
        "value": 880,
        "display_stat_name": "EMaxHealth"
      },
      "weapon_power": {
        "value": 0,
        "display_stat_name": "EWeaponPower"
      },
      "reload_speed": {
        "value": 1,
        "display_stat_name": "EReloadSpeed"
      },
      "weapon_power_scale": {
        "value": 1,
        "display_stat_name": "EWeaponPowerScale"
      },
      "proc_build_up_rate_scale": {
        "value": 1,
        "display_stat_name": "EProcBuildUpRateScale"
      },
      "stamina": {
        "value": 3,
        "display_stat_name": "EStamina"
      },
      "base_health_regen": {
        "value": 2.5,
        "display_stat_name": "EBaseHealthRegen"
      },
      "stamina_regen_per_second": {
        "value": 0.181818,
        "display_stat_name": "EStaminaRegenPerSecond"
      },
      "ability_resource_max": {
        "value": 0,
        "display_stat_name": "EAbilityResourceMax"
      },
      "ability_resource_regen_per_second": {
        "value": 0,
        "display_stat_name": "EAbilityResourceRegenPerSecond"
      },
      "crit_damage_received_scale": {
        "value": 1,
        "display_stat_name": "ECritDamageReceivedScale"
      },
      "tech_duration": {
        "value": 1,
        "display_stat_name": "ETechDuration"
      },
      "tech_range": {
        "value": 1,
        "display_stat_name": "ETechRange"
      },
      "ground_dash_distance_in_meters": {
        "value": 10,
        "display_stat_name": "EGroundDashDistanceInMeters"
      },
      "ground_dash_duration": {
        "value": 0.72,
        "display_stat_name": "EGroundDashDuration"
      },
      "air_dash_distance_in_meters": {
        "value": 8,
        "display_stat_name": "EAirDashDistanceInMeters"
      },
      "air_dash_duration": {
        "value": 0.51,
        "display_stat_name": "EAirDashDuration"
      },
      "ooc_health_regen": {
        "value": 0,
        "display_stat_name": "EOOCHealthRegen"
      }
    },
    "standard_level_up_upgrades": {
      "MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL": 0.115,
      "MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL_ALT_FIRE": 0,
      "MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL": 52,
      "MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL": 1.58,
      "MODIFIER_VALUE_BONUS_ATTACK_RANGE": 59,
      "MODIFIER_VALUE_BOON_COUNT": 1,
      "MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST": 0.3,
      "MODIFIER_VALUE_TECH_RESIST": 0,
      "MODIFIER_VALUE_TECH_DAMAGE_MULTIPLIER": 0,
      "MODIFIER_VALUE_TECH_POWER": 1.1,
      "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN": 0
    },
    "level_info": {
      "1": {
        "bonus_currencies": [
          "EAbilityUnlocks"
        ],
        "required_gold": 0
      },
      "2": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 200
      },
      "3": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityUnlocks"
        ],
        "required_gold": 500
      },
      "4": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 900
      },
      "5": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityUnlocks"
        ],
        "required_gold": 1400
      },
      "6": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 2000
      },
      "7": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 2600
      },
      "8": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityUnlocks"
        ],
        "required_gold": 3200
      },
      "9": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 3900
      },
      "10": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 4600
      },
      "11": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 5300
      },
      "12": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 6000
      },
      "13": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 6800
      },
      "14": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 7600
      },
      "15": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 8400
      },
      "16": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 9200
      },
      "17": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 10100
      },
      "18": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 11000
      },
      "19": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 11900
      },
      "20": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 12800
      },
      "21": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 13800
      },
      "22": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 14900
      },
      "23": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 16100
      },
      "24": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 17400
      },
      "25": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 18900
      },
      "26": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 20600
      },
      "27": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 22500
      },
      "28": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 24600
      },
      "29": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 26900
      },
      "30": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 29400
      },
      "31": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 32100
      },
      "32": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 35000
      },
      "33": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 38100
      },
      "34": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 41400
      },
      "35": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 44900
      },
      "36": {
        "use_standard_upgrade": true,
        "bonus_currencies": [
          "EAbilityPoints"
        ],
        "required_gold": 48600
      }
    },
    "scaling_stats": {},
    "cost_bonuses": {
      "weapon": [
        {
          "gold_threshold": 800,
          "bonus": 9,
          "percent_on_graph": 7
        },
        {
          "gold_threshold": 1600,
          "bonus": 12,
          "percent_on_graph": 7
        },
        {
          "gold_threshold": 2400,
          "bonus": 15,
          "percent_on_graph": 8
        },
        {
          "gold_threshold": 3200,
          "bonus": 18,
          "percent_on_graph": 8
        },
        {
          "gold_threshold": 4800,
          "bonus": 46,
          "percent_on_graph": 9
        },
        {
          "gold_threshold": 6400,
          "bonus": 54,
          "percent_on_graph": 9
        },
        {
          "gold_threshold": 8000,
          "bonus": 62,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 11200,
          "bonus": 74,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 16000,
          "bonus": 86,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 22400,
          "bonus": 100,
          "percent_on_graph": 11
        },
        {
          "gold_threshold": 28800,
          "bonus": 115,
          "percent_on_graph": 11
        }
      ],
      "vitality": [
        {
          "gold_threshold": 800,
          "bonus": 9,
          "percent_on_graph": 7
        },
        {
          "gold_threshold": 1600,
          "bonus": 12,
          "percent_on_graph": 7
        },
        {
          "gold_threshold": 2400,
          "bonus": 15,
          "percent_on_graph": 8
        },
        {
          "gold_threshold": 3200,
          "bonus": 20,
          "percent_on_graph": 8
        },
        {
          "gold_threshold": 4800,
          "bonus": 38,
          "percent_on_graph": 9
        },
        {
          "gold_threshold": 6400,
          "bonus": 42,
          "percent_on_graph": 9
        },
        {
          "gold_threshold": 8000,
          "bonus": 46,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 11200,
          "bonus": 50,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 16000,
          "bonus": 54,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 22400,
          "bonus": 60,
          "percent_on_graph": 11
        },
        {
          "gold_threshold": 28800,
          "bonus": 66,
          "percent_on_graph": 11
        }
      ],
      "spirit": [
        {
          "gold_threshold": 800,
          "bonus": 7,
          "percent_on_graph": 7
        },
        {
          "gold_threshold": 1600,
          "bonus": 11,
          "percent_on_graph": 7
        },
        {
          "gold_threshold": 2400,
          "bonus": 15,
          "percent_on_graph": 8
        },
        {
          "gold_threshold": 3200,
          "bonus": 19,
          "percent_on_graph": 8
        },
        {
          "gold_threshold": 4800,
          "bonus": 38,
          "percent_on_graph": 9
        },
        {
          "gold_threshold": 6400,
          "bonus": 45,
          "percent_on_graph": 9
        },
        {
          "gold_threshold": 8000,
          "bonus": 52,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 11200,
          "bonus": 59,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 16000,
          "bonus": 66,
          "percent_on_graph": 10
        },
        {
          "gold_threshold": 22400,
          "bonus": 75,
          "percent_on_graph": 11
        },
        {
          "gold_threshold": 28800,
          "bonus": 100,
          "percent_on_graph": 11
        }
      ]
    },
    "items": {
      "weapon_primary": "citadel_weapon_bebop_set",
      "weapon_melee": "citadel_ability_melee_bebop",
      "ability_mantle": "citadel_ability_mantle",
      "ability_jump": "citadel_ability_jump",
      "ability_slide": "citadel_ability_slide",
      "ability_zip_line": "citadel_ability_zip_line",
      "ability_zip_line_boost": "citadel_ability_zipline_boost",
      "ability_climb_rope": "citadel_ability_climb_rope",
      "ability_innate1": "citadel_ability_dash",
      "ability_innate2": "citadel_ability_sprint",
      "ability_innate3": "citadel_ability_melee_parry",
      "signature1": "citadel_ability_uppercut",
      "signature2": "citadel_ability_sticky_bomb",
      "signature3": "citadel_ability_hook",
      "signature4": "citadel_ability_bebop_laser_beam"
    }
  },
  "items": {
    "968099481": {
      "id": 968099481,
      "class_name": "upgrade_improved_spirit",
      "start_trained": true,
      "heroes": [],
      "weapon_info": {},
      "type": "upgrade",
      "item_slot_type": "spirit",
      "item_tier": 1,
      "properties": {
        "AbilityCooldown": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCooldown_scale_function",
            "specific_stat_scale_type": "EItemCooldown"
          },
          "postfix": "s"
        },
        "AbilityDuration": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "AbilityCastRange": {
          "value": "0",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_Meters",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCastRange_scale_function",
            "specific_stat_scale_type": "ETechRange"
          },
          "postfix": "m"
        },
        "AbilityUnitTargetLimit": {
          "value": "1",
          "can_set_token_override": true
        },
        "AbilityCastDelay": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "postfix": "s"
        },
        "AbilityChannelTime": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_multi_stats",
            "subclass_name": "scale_duration",
            "scaling_stats": [
              "EChannelDuration",
              "ETechDuration"
            ]
          },
          "postfix": "s"
        },
        "AbilityPostCastDuration": {
          "value": "0",
          "disable_value": "0"
        },
        "AbilityCharges": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "-1",
          "scale_function": {
            "class_name": "scale_function_ability_charges",
            "subclass_name": "AbilityCharges_scale_function"
          }
        },
        "AbilityCooldownBetweenCharge": {
          "value": "-1.0",
          "can_set_token_override": true,
          "disable_value": "-2",
          "scale_function": {
            "class_name": "scale_function_ability_recharge_time",
            "subclass_name": "scale_function_ability_recharge_time"
          },
          "postfix": "s"
        },
        "ChannelMoveSpeed": {
          "value": "-1",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_MetersPerSecond",
          "postfix": "m"
        },
        "AbilityResourceCost": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0"
        },
        "TechPower": {
          "value": "10",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_TECH_POWER",
          "disable_value": "0",
          "postfix": "",
          "tooltip_section": "innate"
        },
        "WeaponPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_WEAPON_POWER",
          "disable_value": "0",
          "postfix": "%"
        },
        "BonusHealthRegen": {
          "provided_property_type": "MODIFIER_VALUE_HEALTH_REGEN_PER_SECOND",
          "postfix": ""
        }
      },
      "activation": "passive",
      "upgrades": [
        {
          "property_upgrades": [
            {
              "name": "TechPower",
              "bonus": "10"
            }
          ]
        }
      ],
      "is_active_item": false,
      "shopable": true,
      "cost": 800,
      "shop_version": 0
    },
    "2163598980": {
      "id": 2163598980,
      "class_name": "upgrade_tech_purge",
      "start_trained": true,
      "heroes": [],
      "weapon_info": {},
      "type": "upgrade",
      "item_slot_type": "vitality",
      "item_tier": 3,
      "properties": {
        "AbilityCooldown": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCooldown_scale_function",
            "specific_stat_scale_type": "EItemCooldown"
          },
          "postfix": "s"
        },
        "AbilityDuration": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "AbilityCastRange": {
          "value": "0",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_Meters",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCastRange_scale_function",
            "specific_stat_scale_type": "ETechRange"
          },
          "postfix": "m"
        },
        "AbilityUnitTargetLimit": {
          "value": "1",
          "can_set_token_override": true
        },
        "AbilityCastDelay": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "postfix": "s"
        },
        "AbilityChannelTime": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_multi_stats",
            "subclass_name": "scale_duration",
            "scaling_stats": [
              "EChannelDuration",
              "ETechDuration"
            ]
          },
          "postfix": "s"
        },
        "AbilityPostCastDuration": {
          "value": "0",
          "disable_value": "0"
        },
        "AbilityCharges": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "-1",
          "scale_function": {
            "class_name": "scale_function_ability_charges",
            "subclass_name": "AbilityCharges_scale_function"
          }
        },
        "AbilityCooldownBetweenCharge": {
          "value": "-1.0",
          "can_set_token_override": true,
          "disable_value": "-2",
          "scale_function": {
            "class_name": "scale_function_ability_recharge_time",
            "subclass_name": "scale_function_ability_recharge_time"
          },
          "postfix": "s"
        },
        "ChannelMoveSpeed": {
          "value": "-1",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_MetersPerSecond",
          "postfix": "m"
        },
        "AbilityResourceCost": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0"
        },
        "TechPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_TECH_POWER",
          "disable_value": "0",
          "postfix": ""
        },
        "WeaponPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_WEAPON_POWER",
          "disable_value": "0",
          "postfix": "%"
        },
        "TechResist": {
          "value": "30",
          "provided_property_type": "MODIFIER_VALUE_TECH_RESIST",
          "usage_flags": [
            "IntrinsicallyProvidedInAbility"
          ],
          "postfix": "%",
          "tooltip_section": "innate"
        },
        "HealthThreshold": {
          "value": "50",
          "tooltip_section": "passive"
        },
        "TechResistBelowThreshold": {
          "value": "15",
          "usage_flags": [
            "ConditionallyApplied"
          ],
          "postfix": "%",
          "tooltip_section": "passive"
        },
        "OutOfCombatHealthRegen": {
          "value": "3",
          "provided_property_type": "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN",
          "postfix": "",
          "tooltip_section": "innate"
        }
      },
      "activation": "passive",
      "upgrades": [
        {
          "property_upgrades": [
            {
              "name": "TechResist",
              "bonus": "10"
            },
            {
              "name": "TechResistBelowThreshold",
              "bonus": "10"
            }
          ]
        }
      ],
      "is_active_item": false,
      "shopable": true,
      "cost": 3200,
      "corrupted_info": {
        "property_upgrades": [
          {
            "name": "OutOfCombatHealthRegen",
            "bonus": "15"
          },
          {
            "name": "TechResist",
            "bonus": "15"
          },
          {
            "name": "TechResistBelowThreshold",
            "bonus": "5"
          },
          {
            "name": "HealthThreshold",
            "bonus": "15"
          }
        ],
        "excluded_penalties": [
          "Health"
        ]
      },
      "shop_version": 0
    },
    "2521902222": {
      "id": 2521902222,
      "class_name": "citadel_ability_sticky_bomb",
      "start_trained": false,
      "hero": 15,
      "heroes": [
        15
      ],
      "properties": {
        "AbilityCooldown": {
          "value": 18,
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCooldown_scale_function",
            "specific_stat_scale_type": "ETechCooldown"
          },
          "postfix": "s"
        },
        "AbilityDuration": {
          "value": "3.5",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "AbilityCastRange": {
          "value": "6m",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_Meters",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCastRange_scale_function",
            "specific_stat_scale_type": "ETechRange"
          },
          "postfix": "m"
        },
        "AbilityUnitTargetLimit": {
          "value": "1",
          "can_set_token_override": true
        },
        "AbilityCastDelay": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "postfix": "s"
        },
        "AbilityChannelTime": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_multi_stats",
            "subclass_name": "scale_duration",
            "scaling_stats": [
              "EChannelDuration",
              "ETechDuration"
            ]
          },
          "postfix": "s"
        },
        "AbilityPostCastDuration": {
          "value": "0",
          "disable_value": "0"
        },
        "AbilityCharges": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "-1",
          "scale_function": {
            "class_name": "scale_function_ability_charges",
            "subclass_name": "AbilityCharges_scale_function"
          }
        },
        "AbilityCooldownBetweenCharge": {
          "value": "-1.0",
          "can_set_token_override": true,
          "disable_value": "-2",
          "scale_function": {
            "class_name": "scale_function_ability_recharge_time",
            "subclass_name": "scale_function_ability_recharge_time"
          },
          "postfix": "s"
        },
        "ChannelMoveSpeed": {
          "value": "-1",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_MetersPerSecond",
          "postfix": "m"
        },
        "AbilityResourceCost": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0"
        },
        "TechPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_TECH_POWER",
          "disable_value": "0",
          "postfix": ""
        },
        "WeaponPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_WEAPON_POWER",
          "disable_value": "0",
          "postfix": "%"
        },
        "Radius": {
          "value": "8m",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "Radius_scale_function",
            "specific_stat_scale_type": "ETechRadius"
          },
          "postfix": "m"
        },
        "FuseTime": {
          "value": "3.5",
          "postfix": "s"
        },
        "KillCheckWindow": {
          "value": "10.0"
        },
        "OnHitDiminish": {
          "value": "60"
        },
        "OnKillDiminish": {
          "value": "7"
        },
        "SelfDamagePercent": {
          "value": "20",
          "postfix": "%"
        },
        "Damage": {
          "value": 85,
          "scale_function": {
            "class_name": "scale_function_tech_damage",
            "subclass_name": "damage_scale",
            "specific_stat_scale_type": "ETechPower",
            "stat_scale": 1.5
          }
        },
        "BonusDamagePctPerPlayerKilled": {
          "value": "2.5",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "damage_scale_per_kill",
            "specific_stat_scale_type": "ETechPower",
            "stat_scale": 0.01
          },
          "postfix": "%"
        },
        "BonusDamagePctPerPlayerHit": {
          "value": "1.0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "damage_scale_per_hit",
            "specific_stat_scale_type": "ETechPower",
            "stat_scale": 0.0015
          },
          "postfix": "%"
        },
        "StunTargetOnExplode": {
          "value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "StunTargetOnExplode_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "DebuffDuration": {
          "value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "DebuffDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "OutgoingDamagePercent": {
          "value": "0",
          "provided_property_type": "MODIFIER_VALUE_ALL_DAMAGE_MULTIPLIER",
          "usage_flags": [
            "IntrinsicallyProvidedInAbility"
          ],
          "postfix": "%"
        },
        "MovementSpeedBonus": {
          "value": "0",
          "provided_property_type": "MODIFIER_VALUE_MOVEMENT_SPEED_MAX",
          "usage_flags": [
            "ConditionallyApplied"
          ],
          "display_units": "EDisplayUnit_MetersPerSecond"
        },
        "BonusFireRate": {
          "value": "0",
          "provided_property_type": "MODIFIER_VALUE_FIRE_RATE",
          "usage_flags": [
            "ConditionallyEnemyApplied"
          ],
          "postfix": "%"
        },
        "MovementSpeedBonusDuration": {
          "value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "MovementSpeedBonusDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "StatusResistancePercent": {
          "value": "0",
          "provided_property_type": "MODIFIER_VALUE_STATUS_RESISTANCE",
          "postfix": "%"
        },
        "TechResist": {
          "value": "0",
          "provided_property_type": "MODIFIER_VALUE_TECH_RESIST",
          "postfix": "%"
        }
      },
      "weapon_info": {},
      "type": "ability",
      "behaviours": [
        "CITADEL_ABILITY_BEHAVIOR_ALLOW_SELF_CAST",
        "CITADEL_ABILITY_BEHAVIOR_DISPLAYS_DAMAGE_IMPACT",
        "CITADEL_ABILITY_BEHAVIOR_USE_INSTANT_CAST_UNIT_TARGET_UI",
        "CITADEL_ABILITY_BEHAVIOR_CAN_SET_QUICK_CAST"
      ],
      "upgrades": [
        {
          "property_upgrades": [
            {
              "name": "AbilityCooldown",
              "bonus": -8
            }
          ]
        },
        {
          "property_upgrades": [
            {
              "name": "Damage",
              "bonus": 85
            }
          ]
        },
        {
          "property_upgrades": [
            {
              "name": "MovementSpeedBonus",
              "bonus": "5m"
            },
            {
              "name": "StatusResistancePercent",
              "bonus": "25"
            },
            {
              "name": "MovementSpeedBonusDuration",
              "bonus": "6"
            }
          ]
        }
      ],
      "ability_type": "signature",
      "boss_damage_scale": 1
    },
    "3140772621": {
      "id": 3140772621,
      "class_name": "upgrade_improved_bullet_armor",
      "start_trained": true,
      "heroes": [],
      "weapon_info": {},
      "type": "upgrade",
      "item_slot_type": "vitality",
      "item_tier": 3,
      "properties": {
        "AbilityCooldown": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCooldown_scale_function",
            "specific_stat_scale_type": "EItemCooldown"
          },
          "postfix": "s"
        },
        "AbilityDuration": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "AbilityCastRange": {
          "value": "0",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_Meters",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCastRange_scale_function",
            "specific_stat_scale_type": "ETechRange"
          },
          "postfix": "m"
        },
        "AbilityUnitTargetLimit": {
          "value": "1",
          "can_set_token_override": true
        },
        "AbilityCastDelay": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "postfix": "s"
        },
        "AbilityChannelTime": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_multi_stats",
            "subclass_name": "scale_duration",
            "scaling_stats": [
              "EChannelDuration",
              "ETechDuration"
            ]
          },
          "postfix": "s"
        },
        "AbilityPostCastDuration": {
          "value": "0",
          "disable_value": "0"
        },
        "AbilityCharges": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "-1",
          "scale_function": {
            "class_name": "scale_function_ability_charges",
            "subclass_name": "AbilityCharges_scale_function"
          }
        },
        "AbilityCooldownBetweenCharge": {
          "value": "-1.0",
          "can_set_token_override": true,
          "disable_value": "-2",
          "scale_function": {
            "class_name": "scale_function_ability_recharge_time",
            "subclass_name": "scale_function_ability_recharge_time"
          },
          "postfix": "s"
        },
        "ChannelMoveSpeed": {
          "value": "-1",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_MetersPerSecond",
          "postfix": "m"
        },
        "AbilityResourceCost": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0"
        },
        "TechPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_TECH_POWER",
          "disable_value": "0",
          "postfix": ""
        },
        "WeaponPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_WEAPON_POWER",
          "disable_value": "0",
          "postfix": "%"
        },
        "BulletResist": {
          "value": "30",
          "provided_property_type": "MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST",
          "usage_flags": [
            "IntrinsicallyProvidedInAbility"
          ],
          "postfix": "%",
          "tooltip_section": "innate"
        },
        "HealthThreshold": {
          "value": "50",
          "tooltip_section": "passive"
        },
        "BulletResistBelowThreshold": {
          "value": "15",
          "usage_flags": [
            "ConditionallyApplied"
          ],
          "postfix": "%",
          "tooltip_section": "passive"
        },
        "OutOfCombatHealthRegen": {
          "value": "3",
          "provided_property_type": "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN",
          "postfix": "",
          "tooltip_section": "innate"
        }
      },
      "activation": "passive",
      "upgrades": [
        {
          "property_upgrades": [
            {
              "name": "BulletResist",
              "bonus": "10"
            },
            {
              "name": "BulletResistBelowThreshold",
              "bonus": "10"
            }
          ]
        }
      ],
      "is_active_item": false,
      "shopable": true,
      "cost": 3200,
      "corrupted_info": {
        "property_upgrades": [
          {
            "name": "OutOfCombatHealthRegen",
            "bonus": "15"
          },
          {
            "name": "BulletResist",
            "bonus": "15"
          },
          {
            "name": "BulletResistBelowThreshold",
            "bonus": "5"
          }
        ],
        "excluded_penalties": [
          "Health"
        ]
      },
      "shop_version": 0
    },
    "3633614685": {
      "id": 3633614685,
      "class_name": "upgrade_health",
      "start_trained": true,
      "heroes": [],
      "weapon_info": {},
      "type": "upgrade",
      "item_slot_type": "vitality",
      "item_tier": 1,
      "properties": {
        "AbilityCooldown": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCooldown_scale_function",
            "specific_stat_scale_type": "EItemCooldown"
          },
          "postfix": "s"
        },
        "AbilityDuration": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "AbilityCastRange": {
          "value": "0",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_Meters",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCastRange_scale_function",
            "specific_stat_scale_type": "ETechRange"
          },
          "postfix": "m"
        },
        "AbilityUnitTargetLimit": {
          "value": "1",
          "can_set_token_override": true
        },
        "AbilityCastDelay": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "postfix": "s"
        },
        "AbilityChannelTime": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_multi_stats",
            "subclass_name": "scale_duration",
            "scaling_stats": [
              "EChannelDuration",
              "ETechDuration"
            ]
          },
          "postfix": "s"
        },
        "AbilityPostCastDuration": {
          "value": "0",
          "disable_value": "0"
        },
        "AbilityCharges": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "-1",
          "scale_function": {
            "class_name": "scale_function_ability_charges",
            "subclass_name": "AbilityCharges_scale_function"
          }
        },
        "AbilityCooldownBetweenCharge": {
          "value": "-1.0",
          "can_set_token_override": true,
          "disable_value": "-2",
          "scale_function": {
            "class_name": "scale_function_ability_recharge_time",
            "subclass_name": "scale_function_ability_recharge_time"
          },
          "postfix": "s"
        },
        "ChannelMoveSpeed": {
          "value": "-1",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_MetersPerSecond",
          "postfix": "m"
        },
        "AbilityResourceCost": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0"
        },
        "TechPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_TECH_POWER",
          "disable_value": "0",
          "postfix": ""
        },
        "WeaponPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_WEAPON_POWER",
          "disable_value": "0",
          "postfix": "%"
        },
        "BonusHealth": {
          "value": "210",
          "provided_property_type": "MODIFIER_VALUE_HEALTH_MAX",
          "tooltip_section": "innate"
        },
        "BaseAttackDamagePercent": {
          "provided_property_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE",
          "disable_value": "",
          "display_units": "EDisplayUnit_Normal",
          "postfix": "%"
        }
      },
      "activation": "passive",
      "upgrades": [
        {
          "property_upgrades": [
            {
              "name": "BonusHealth",
              "bonus": "115"
            }
          ]
        }
      ],
      "is_active_item": false,
      "shopable": true,
      "cost": 800,
      "shop_version": 0
    },
    "3764085067": {
      "id": 3764085067,
      "class_name": "citadel_weapon_bebop_set",
      "start_trained": true,
      "hero": 15,
      "heroes": [
        15
      ],
      "properties": {
        "AbilityCooldown": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCooldown_scale_function",
            "specific_stat_scale_type": "ETechCooldown"
          },
          "postfix": "s"
        },
        "AbilityDuration": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityDuration_scale_function",
            "specific_stat_scale_type": "ETechDuration"
          },
          "postfix": "s"
        },
        "AbilityCastRange": {
          "value": "0",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_Meters",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "AbilityCastRange_scale_function",
            "specific_stat_scale_type": "ETechRange"
          },
          "postfix": "m"
        },
        "AbilityUnitTargetLimit": {
          "value": "1",
          "can_set_token_override": true
        },
        "AbilityCastDelay": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "postfix": "s"
        },
        "AbilityChannelTime": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0",
          "scale_function": {
            "class_name": "scale_function_multi_stats",
            "subclass_name": "scale_duration",
            "scaling_stats": [
              "EChannelDuration",
              "ETechDuration"
            ]
          },
          "postfix": "s"
        },
        "AbilityPostCastDuration": {
          "value": "0",
          "disable_value": "0"
        },
        "AbilityCharges": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "-1",
          "scale_function": {
            "class_name": "scale_function_ability_charges",
            "subclass_name": "AbilityCharges_scale_function"
          }
        },
        "AbilityCooldownBetweenCharge": {
          "value": "-1.0",
          "can_set_token_override": true,
          "disable_value": "-2",
          "scale_function": {
            "class_name": "scale_function_ability_recharge_time",
            "subclass_name": "scale_function_ability_recharge_time"
          },
          "postfix": "s"
        },
        "ChannelMoveSpeed": {
          "value": "-1",
          "can_set_token_override": true,
          "display_units": "EDisplayUnit_MetersPerSecond",
          "postfix": "m"
        },
        "AbilityResourceCost": {
          "value": "0",
          "can_set_token_override": true,
          "disable_value": "0"
        },
        "TechPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_TECH_POWER",
          "disable_value": "0",
          "postfix": ""
        },
        "WeaponPower": {
          "value": "0",
          "can_set_token_override": true,
          "provided_property_type": "MODIFIER_VALUE_WEAPON_POWER",
          "disable_value": "0",
          "postfix": "%"
        },
        "WindUpTime": {
          "value": "0.3",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "WindUpTime_scale_function",
            "specific_stat_scale_type": "EReloadSpeed"
          },
          "postfix": "s"
        },
        "NoWindUpTime": {
          "value": "0.05",
          "scale_function": {
            "class_name": "scale_function_single_stat",
            "subclass_name": "NoWindUpTime_scale_function",
            "specific_stat_scale_type": "EReloadSpeed"
          }
        }
      },
      "weapon_info": {
        "can_zoom": true,
        "bullet_damage": 4.98,
        "bullet_gravity_scale": 0.8,
        "bullet_inherit_shooter_velocity_scale": 0,
        "bullet_lifetime": 2,
        "bullet_radius": 3,
        "bullet_reflect_amount": 1,
        "bullet_reflect_scale": 0,
        "bullet_whiz_distance": 80,
        "crit_bonus_against_npcs": 0,
        "crit_bonus_end": 1.65,
        "crit_bonus_end_range": 1500,
        "crit_bonus_start": 1.65,
        "crit_bonus_start_range": 500,
        "cycle_time": 0.084,
        "intra_burst_cycle_time": 0,
        "damage_falloff_bias": 0.5,
        "damage_falloff_end_range": 2000,
        "damage_falloff_end_scale": 0.1,
        "damage_falloff_start_range": 787,
        "damage_falloff_start_scale": 1,
        "horizontal_punch": 0,
        "range": 1259.84,
        "bullet_speed": 20000,
        "recoil_recovery_speed": 10,
        "recoil_shot_index_recovery_time_factor": 0.25,
        "recoil_speed": 1,
        "reload_move_speed": 10000,
        "scatter_yaw_scale": 1,
        "shoot_move_speed_percent": 0.75,
        "shoot_spread_penalty_decay": 2,
        "shoot_spread_penalty_decay_delay": 0,
        "shoot_spread_penalty_per_shot": 0,
        "shooting_up_spread_penalty": 0,
        "vertical_punch": 0,
        "zoom_fov": 35,
        "zoom_move_speed_percent": 1,
        "bullets": 1,
        "burst_shot_count": 1,
        "clip_size": 66,
        "spread": 0.05,
        "standing_spread": 1.5,
        "reload_duration": 2.35,
        "horizontal_recoil": {
          "range": [
            0,
            0
          ],
          "burst_exponent": 0
        },
        "vertical_recoil": {
          "range": [
            0,
            0
          ],
          "burst_exponent": 0,
          "burst_constant": 0,
          "burst_slope": 0
        },
        "bullet_handler_type": "EBulletHandler_Beam",
        "shots_per_second": 11.904761904761903,
        "shots_per_second_with_reload": 8.104125736738704,
        "bullets_per_second": 11.904761904761903,
        "bullets_per_second_with_reload": 8.104125736738704,
        "damage_per_second": 59.285714285714285,
        "damage_per_second_with_reload": 40.358546168958746,
        "damage_per_shot": 4.98,
        "damage_per_magazine": 328.68
      },
      "type": "weapon"
    }
  },
  "propertyPresentationKeys": [
    "label",
    "postvalue_label",
    "icon",
    "css_class",
    "prefix",
    "tooltip_is_elevated",
    "tooltip_is_important",
    "loc_token_override"
  ],
  "itemPresentationKeys": [
    "name",
    "image",
    "image_webp",
    "shop_image",
    "shop_image_webp",
    "description",
    "tooltip_details",
    "tooltip_sections",
    "update_time"
  ],
  "heroKeys": [
    "id",
    "class_name",
    "starting_stats",
    "standard_level_up_upgrades",
    "level_info",
    "scaling_stats",
    "cost_bonuses",
    "items"
  ]
};
