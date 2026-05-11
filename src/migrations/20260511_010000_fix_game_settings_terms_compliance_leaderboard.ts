import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Hotfix — 補齊 game_settings 的 terms / compliance / leaderboard 15 欄
 *
 * PR #212 (commit 99f1dd1 「刮刮卡 UX 重做 + PrizePool 大獎池 + 規範同意書 + APP API/下載頁」)
 * 在 src/globals/GameSettings.ts 加了 3 個 group：
 *   - terms        (5 個 sub-field)
 *   - compliance   (3 個 sub-field)
 *   - leaderboard  (7 個 sub-field)
 *
 * 但同 PR 只附了兩條 migration：
 *   - 20260509_100000_add_prize_pools          → 建 prize_pools 主 + 子表
 *   - 20260509_110000_add_game_terms_acceptance → 加 users.game_terms_acceptance_*
 *
 * 兩條都「沒動 game_settings」。結果 game_settings 表 schema 還是舊的，
 * 但 Payload 從 TS field 定義產生的查詢會 SELECT terms_enabled / compliance_*
 * / leaderboard_* 等 15 欄 →
 *   SQLITE_ERROR: no such column: terms_enabled
 *
 * 影響：/games、/games/[slug]、/games/terms、/admin/globals/game-settings 全部
 * 在 SSR 階段觸發 findGlobal('game-settings') 時 throw，Next 把 error boundary
 * 接走後渲染 boot beacon「頁面載入失敗」殼。Prod log 看得到原始 SqliteError。
 *
 * 修法：補齊 15 欄到 game_settings，DEFAULT 對齊 TS field 的 defaultValue。
 * 冪等：PRAGMA columnExists 判斷再加，pattern 沿襲 20260509_110000_add_game_terms_acceptance。
 *
 * down() no-op — SQLite DROP COLUMN 成本高，dangling column 無害。
 *
 * 發現脈絡：Session 32 PR #231 收尾後 user 報「pre.chickimmiu.com 問題很多 / 之前
 * 做的頁面沒顯示出來」。SSH pm2 log tail 抓到唯一一條 "no such column: terms_enabled"。
 */

async function columnExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await db.run(sql.raw(`PRAGMA table_info('${table}');`))
  const rows = (res?.rows ?? res ?? []) as Array<Record<string, unknown>>
  return rows.some((r) => r?.name === column)
}

// SQL-safe escape for default text values（單引號 doubled）
function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

// TS field defaultValue → SQL DEFAULT 字串對齊
const TERMS_FULL_CONTENT_DEFAULT = `CHIC KIM & MIU 遊戲規範與獎項說明

一、適用範圍
本規範適用於 CHIC KIM & MIU 網站、APP 內所有互動遊戲與獎項活動（以下簡稱「本遊戲」）。

二、參與資格
1. 完成 CHIC KIM & MIU 會員註冊並通過 email 驗證之會員方可參與。
2. 未滿 20 歲之未成年會員，須經法定代理人同意方可參與。
3. 本公司員工及其二親等內親屬不得參與抽獎活動。

三、獎項與機率公示
1. 各遊戲獎項清單、中獎機率、剩餘庫存依即時資料公示於本網站「/games/terms」頁面。
2. 獎品內容及中獎機率得依營運需求調整，調整時將同步更新本規範並另行公告。
3. 點數、購物金、優惠券等獎項以系統紀錄為準，不得兌換現金、不得轉讓他人。

四、獎品兌換與寄送
1. 點數及購物金中獎後即時入帳，可於下次消費使用，無使用期限（除遊戲設定點數有效期外）。
2. 電子優惠券中獎後將自動加入「會員寶物箱」，於有效期內使用。
3. 實體贈品（如電影票、贈品等）將於會員下次訂單寄出時隨單一同寄出，會員須於得獎日起 12 個月內下單方可寄出，逾期視同放棄。
4. 獎品恕不退換、不轉讓、不寄送至海外地址；如該獎品市場停售或公司因故無法提供，本公司保留以等值或近似獎品替換之權利。

五、消費型遊戲機制
1. 每位會員每日免費遊戲次數依會員等級提供；額外次數需消耗會員點數，點數消耗後不可退還。
2. 會員點數及購物金均為消費回饋，不具金錢價值，不得交易、贈與、變賣或要求退換成現金。
3. 遊戲結果由系統根據後台設定機率即時計算，所有抽獎結果以伺服器紀錄為準。

六、禁止行為
會員有下列行為之一者，本公司得取消其得獎資格、追回獎品並終止其會員資格，必要時得依法追訴：
1. 以不正當方式（包含但不限於多重帳號、自動化程式、機器人、竊取他人帳號、偽造資料等）參與本遊戲。
2. 散布不實資訊、騷擾其他會員或本公司客服人員。
3. 違反相關法令、消費者保護法、個人資料保護法或公序良俗之行為。

七、爭議處理
獎項相關爭議請於得獎日起 30 日內透過客服中心聯繫，逾期視同認可。
客服信箱：service@chickimmiu.com

八、智慧財產權
本遊戲所有美術設計、文案、商標、視覺元素、音效等均屬本公司所有，未經書面同意不得重製、改作、散布或為其他商業利用。

九、隱私權
會員參與本遊戲時，本公司將依本網站「隱私權政策」蒐集、處理及利用其個人資料；會員資料將用於獎項發放、活動通知、會員服務等用途。

十、規範修訂
本公司得隨時修訂本規範，修訂後將公告於本網站並推播予會員，修訂後之規範自公告日起生效。會員繼續使用本遊戲視同同意修訂後之規範；如不同意修訂內容，會員應停止使用本遊戲。

十一、準據法及管轄法院
本規範以中華民國法律為準據法。因本規範或本遊戲所生之任何爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。

十二、聲明
1. 本遊戲為純粹娛樂消費回饋活動，不具任何投資、賭博性質。
2. 本公司保留隨時暫停、修改、終止本遊戲之權利。
3. 本規範未盡事宜，依「會員條款」「隱私權政策」及相關法令規定辦理。`

const TERMS_SHORT_SUMMARY_DEFAULT =
  '本遊戲所獲點數、購物金、優惠券皆為會員消費回饋，不具金錢價值，不得兌換現金。實體獎品須隨下次訂單寄出，請於 12 個月內下單。詳細條文請見「遊戲規範與獎項」頁面。'

const COLS: Array<{ name: string; def: string }> = [
  // terms group
  { name: 'terms_enabled', def: 'integer DEFAULT 1' },
  { name: 'terms_version', def: `text DEFAULT '2026-05-09-v1' NOT NULL` },
  { name: 'terms_last_updated_at', def: 'text' },
  { name: 'terms_short_summary', def: `text DEFAULT ${q(TERMS_SHORT_SUMMARY_DEFAULT)}` },
  { name: 'terms_full_content', def: `text DEFAULT ${q(TERMS_FULL_CONTENT_DEFAULT)}` },
  // compliance group
  { name: 'compliance_monthly_max_value_per_user', def: 'numeric DEFAULT 5000' },
  { name: 'compliance_abnormal_threshold_per_hour', def: 'numeric DEFAULT 5' },
  { name: 'compliance_require_adult_confirmation', def: 'integer DEFAULT 1' },
  // leaderboard group
  { name: 'leaderboard_enabled', def: 'integer DEFAULT 1' },
  { name: 'leaderboard_reset_daily', def: 'integer DEFAULT 1' },
  { name: 'leaderboard_reset_weekly', def: 'integer DEFAULT 1' },
  { name: 'leaderboard_reset_monthly', def: 'integer DEFAULT 1' },
  { name: 'leaderboard_top3_daily_bonus', def: 'numeric DEFAULT 100' },
  { name: 'leaderboard_top3_weekly_bonus', def: 'numeric DEFAULT 500' },
  { name: 'leaderboard_top3_monthly_bonus', def: 'numeric DEFAULT 2000' },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const c of COLS) {
    if (!(await columnExists(db, 'game_settings', c.name))) {
      await db.run(sql.raw(`ALTER TABLE \`game_settings\` ADD COLUMN \`${c.name}\` ${c.def};`))
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // SQLite DROP COLUMN 成本高且少用；保留 dangling column 無害
}
