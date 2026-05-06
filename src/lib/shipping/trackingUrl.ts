/**
 * Carrier code → public tracking URL builder + display label.
 *
 * Carrier codes match Orders.shippingMethod.carrier values
 * (see [Orders.ts:321](../../collections/Orders.ts:321)).
 *
 * Unknown carriers return null URL → UI falls back to plain text.
 */

const URL_BUILDERS: Record<string, (encoded: string) => string> = {
  '711':  (n) => `https://eservice.7-11.com.tw/e-tracking/search.aspx?id=${n}`,
  family: (n) => `https://famiport.com.tw/Web_Famiport/page/famiportt.aspx?inputno=${n}`,
  hilife: (n) => `https://www.hilife.com.tw/serviceInfo_search_result.aspx?l1=${n}`,
  ok:     (n) => `https://www.okmart.com.tw/conveniencestore/search?keyword=${n}`,
  tcat:   (n) => `https://www.t-cat.com.tw/Inquire/TraceDetail.aspx?BillID=${n}`,
  hct:    (n) => `https://www.hct.com.tw/Search/SearchGoods_Step1?CHK=${n}`,
  kerry:  (n) => `https://www.kerrytj.com/ZH/search/search.aspx?qry=${n}`,
  post:   (n) => `https://postserv.post.gov.tw/pstmail/main_mail.html?id=${n}`,
}

const CARRIER_LABEL: Record<string, string> = {
  '711':  '7-ELEVEN 取貨',
  family: '全家便利商店',
  hilife: '萊爾富',
  ok:     'OK 超商',
  tcat:   '黑貓宅急便',
  hct:    '新竹物流',
  kerry:  '嘉里大榮',
  post:   '中華郵政',
}

export function getTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  if (!carrier || !trackingNumber) return null
  const builder = URL_BUILDERS[carrier]
  if (!builder) return null
  return builder(encodeURIComponent(trackingNumber))
}

export function getCarrierLabel(carrier: string | null | undefined): string {
  if (!carrier) return '物流商'
  return CARRIER_LABEL[carrier] || carrier
}

export const SUPPORTED_CARRIERS = Object.keys(CARRIER_LABEL)
