/**
 * 造型卡牌系統的常數與共用型別。
 *
 * 這些數字是 2026-04-21 決策的業務規則；要改必須走 scope 確認。
 * admin-configurable 的值（pointsShopPrice / burnPointsReward per template）
 * 放在 collectible-card-templates 欄位，不在這裡。
 */

/** 商品定價門檻：單價 > NT$5,000 才 mint limited 卡（購買路徑）。 */
export const LIMITED_PRICE_THRESHOLD = 5000

/** 普通卡銷毀換點：所有 common 卡一律 30 點（不區分商品）。 */
export const COMMON_BURN_POINTS = 30

/** 合成公式：3 張同 SKU common 卡 → 1 張該 SKU limited 卡。 */
export const CRAFT_COMMON_INPUT_COUNT = 3
