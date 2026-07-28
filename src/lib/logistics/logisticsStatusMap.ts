/**
 * ECPay 物流貨態代碼 → 訂單里程碑對照
 * ──────────────────────────────────
 * 來源：綠界「物流狀態代碼一覽表」官方 xlsx（2026-07 版，
 * developers.ecpay.com.tw/logistics_status/）。各超商共用同一組貨態
 * 形式資料，但代碼各家不同，一定要按 LogisticsSubType 分表對照。
 *
 * 只挑「值得動訂單狀態」的里程碑碼；其餘（理貨中/天候延遲/門市關轉…）
 * 一律 null = 只記錄在 shippingMethod.logisticsStatus，不動狀態。
 *
 * 里程碑：
 *   arrived_store  — 包裹配達取件門市（買家可取）：只記錄，不改狀態
 *   picked_up      — 買家已到店取貨 → status delivered
 *   delivered_home — 宅配配完 → status delivered
 *   returning      — 未取/異常，退回途中：只記錄
 *   returned       — 已退至寄件門市 / 賣家已取回 → status returned
 *
 * ⚠️ OK 超商（OKMARTC2C）C2C 配送服務已於 2026/7/1 終止（碼表異動
 * 歷程載明），不再列入。
 */

export type LogisticsMilestone =
  | 'arrived_store'
  | 'picked_up'
  | 'delivered_home'
  | 'returning'
  | 'returned'

type MilestoneTable = Partial<Record<LogisticsMilestone, readonly string[]>>

const TABLES: Record<string, MilestoneTable> = {
  UNIMARTC2C: {
    arrived_store: ['2073', '2098'],
    picked_up: ['2067'],
    // 2053 誤刷取件退回中、2066 確認中將退回、2074/2075 未取將退回、
    // 2076/2078 未取已退回物流中心、2097 宅配退回中、2099 重新配達寄件門市
    returning: ['2053', '2066', '2074', '2075', '2076', '2078', '2097', '2099'],
    // 2072 已退至原寄件門市、2070 賣家已取退回包裹、2069 退貨便收件
    returned: ['2069', '2070', '2072'],
  },
  FAMIC2C: {
    arrived_store: ['3018', '3029'],
    picked_up: ['3022'],
    returning: ['3020', '3025', '7016'],
    returned: ['3019', '3023', '3031'],
  },
  HILIFEC2C: {
    arrived_store: ['2063', '2073', '3018', '3029'],
    picked_up: ['2067', '3022'],
    returning: ['2046', '2053', '2055', '2065', '2066', '2074', '2075', '3020', '3025'],
    returned: ['2069', '2070', '2072', '3019', '3023', '3031'],
  },
  TCAT: {
    // 3121 轉交門市配達 = 包裹放到超商待取，尚未到買家手上
    arrived_store: ['3121'],
    delivered_home: ['3003'],
    // 3117 拒收、3123 逾期未取門市刷退、3124 退貨包裹待司機取回、
    // 3125 司機已到門市取回（仍在退回途中）、5004 一般單退回
    returning: ['3117', '3123', '3124', '3125', '5004'],
    // 5008 退貨配完（退回件已送回寄件人）
    returned: ['5008'],
  },
  POST: {
    // 中華郵政碼表只有交寄/招領/投遞不成功/銷毀，無明確配達碼——全部只記錄
    returning: ['3303'],
  },
}

/** 依物流子類型 + 貨態代碼判斷里程碑；非里程碑碼回 null（只記錄） */
export function classifyLogisticsStatus(
  logisticsSubType: string,
  rtnCode: string,
): LogisticsMilestone | null {
  const table = TABLES[logisticsSubType]
  if (!table) return null
  const code = String(rtnCode || '').trim()
  for (const [milestone, codes] of Object.entries(table) as Array<
    [LogisticsMilestone, readonly string[]]
  >) {
    if (codes.includes(code)) return milestone
  }
  return null
}

/**
 * 里程碑 → 訂單狀態流轉（冪等 + 不倒退）：
 * 回 null = 不動狀態。呼叫端還會受 OrderSettings.statusFlow.
 * autoStatusFromLogistics 總開關節制。
 */
export function nextOrderStatus(
  milestone: LogisticsMilestone,
  currentStatus: string,
): 'delivered' | 'returned' | null {
  switch (milestone) {
    case 'picked_up':
    case 'delivered_home':
      // 已取貨/配完：出貨中（甚至漏標 shipped）的單都補到 delivered
      return ['pending', 'processing', 'shipped'].includes(currentStatus) ? 'delivered' : null
    case 'returned':
      // 退回完成：shipped（未取退回）或 delivered（誤刷/退貨便）都收斂到 returned
      return ['shipped', 'delivered'].includes(currentStatus) ? 'returned' : null
    default:
      return null
  }
}
