import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * App 專屬活動設定（App 有、CKMU 網站沒有的三項活動）
 * ═══════════════════════════════════════════════════
 * 對應工單「App 專屬活動：發獎與資料遷移」（2026-08-25）。
 *
 * 共通規則（工單第一章）在這裡的落點：
 *   #1 原本發「金金幣」的改發點數；「經驗積分」不再發放 —— 所以這裡只有點數欄位，
 *      沒有金幣/積分欄位。
 *   #2 獎勵數值可於後台動態設定，且 App 讀得到 —— read 開放（同 game-settings），
 *      由 GET /api/app/activities/settings 帶給 App 渲染畫面與送出前預檢。
 *   #3 App 不得指定發放數量 —— 端點一律只收「要領哪個里程碑／哪篇文章」，
 *      實際點數由後端從這裡取值。
 *
 * 存放位置比照 game-settings（工單指定）。
 */
export const AppActivitySettings: GlobalConfig = {
  slug: 'app-activity-settings',
  label: 'App 活動設定',
  admin: {
    group: '⑤ 互動體驗',
    description: '愛旅遊閱讀獎勵、團購好物分享、散步趣 —— App 專屬三項活動的獎勵與規則',
  },
  access: {
    // App 需要讀取才能渲染畫面與送出前預檢（工單共通規則 #2）
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ══════════════════════════════════════
        {
          label: '愛旅遊 閱讀獎勵',
          fields: [
            {
              name: 'travelRead',
              type: 'group',
              label: '愛旅遊閱讀獎勵',
              fields: [
                {
                  name: 'isActive',
                  label: '啟用活動',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: { description: '關閉時領獎端點會拒絕並回錯誤碼 ACTIVITY_INACTIVE' },
                },
                {
                  name: 'pointsPerArticle',
                  label: '每篇可得點數',
                  type: 'number',
                  defaultValue: 1,
                  min: 0,
                  admin: {
                    description:
                      '同一篇文章每位會員只能領一次。App 現況為 1 金幣，遷移後改發點數；' +
                      '原本的 30 經驗積分依共通規則不再發放',
                  },
                },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        {
          label: '團購 好物分享',
          fields: [
            {
              name: 'groupBuyShare',
              type: 'group',
              label: '團購好物分享',
              fields: [
                {
                  name: 'isActive',
                  label: '啟用活動',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    description:
                      '關閉時「建立分享／編輯分享／建立留言」一律拒絕（錯誤碼 ACTIVITY_INACTIVE）；' +
                      '讀取與檢舉不受影響，已在審核佇列中的分享照常審核與發獎',
                  },
                },
                {
                  name: 'sharePoints',
                  label: '分享獎勵點數',
                  type: 'number',
                  defaultValue: 10,
                  min: 0,
                  admin: { description: '審核通過時發放；同一會員同一文章只有第一篇發獎' },
                },
                {
                  name: 'featuredPoints',
                  label: '精選加碼點數',
                  type: 'number',
                  defaultValue: 20,
                  min: 0,
                  admin: {
                    description:
                      '後台把分享標為「金金精選」時發放（僅 approved 的分享會發）。' +
                      '以 featuredAt 判定是否已發過，取消精選後再標記不會重複發',
                  },
                },
                {
                  name: 'minContentLength',
                  label: '內容字數下限',
                  type: 'number',
                  defaultValue: 20,
                  min: 0,
                  admin: { description: '未達下限拒絕；錯誤回應會帶上此值供 App 組文案' },
                },
                {
                  name: 'maxImages',
                  label: '照片張數上限',
                  type: 'number',
                  defaultValue: 5,
                  min: 1,
                  admin: { description: '至少 1 張、最多此數量' },
                },
                {
                  name: 'editableHours',
                  label: '可編輯時數',
                  type: 'number',
                  defaultValue: 24,
                  min: 0,
                  admin: {
                    description:
                      '自建立時間起算，逾期不可編輯（與審核進度無關 —— 刻意如此，' +
                      '避免「等審完再改」成為繞過審核的路徑）',
                  },
                },
                {
                  name: 'bannedWords',
                  label: '關鍵字過濾清單',
                  type: 'array',
                  admin: {
                    description:
                      '分享與留言共用同一份清單；命中即擋下。此清單不會回傳給 App，由後端判定',
                  },
                  fields: [{ name: 'word', label: '關鍵字', type: 'text', required: true }],
                },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        {
          label: '散步趣',
          fields: [
            {
              name: 'stepChallenge',
              type: 'group',
              label: '散步趣（每日 + 每週）',
              fields: [
                {
                  name: 'isActive',
                  label: '啟用活動',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    description:
                      '關閉時兩個領獎端點拒絕（錯誤碼 ACTIVITY_INACTIVE）；' +
                      '步數上傳仍照常接收（避免關閉期間的步數遺失），讀取類端點不受影響',
                  },
                },
                {
                  name: 'dailyMilestones',
                  label: '每日里程碑',
                  type: 'array',
                  admin: {
                    description:
                      '領獎時 milestone 必須存在於此清單，否則拒絕（錯誤碼 MILESTONE_NOT_FOUND）。' +
                      'App 用這份清單畫里程碑按鈕',
                  },
                  fields: [
                    { name: 'steps', label: '步數門檻', type: 'number', required: true, min: 1 },
                    { name: 'points', label: '獎勵點數', type: 'number', required: true, min: 0 },
                  ],
                },
                {
                  name: 'weeklyMilestone',
                  label: '每週里程碑',
                  type: 'group',
                  fields: [
                    { name: 'steps', label: '步數門檻', type: 'number', defaultValue: 50000, min: 1 },
                    { name: 'points', label: '獎勵點數', type: 'number', defaultValue: 30, min: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
