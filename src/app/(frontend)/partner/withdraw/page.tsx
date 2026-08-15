import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getOwnAffiliate } from '@/lib/affiliate/getOwnAffiliate'
import { WithdrawClient } from './WithdrawClient'

export default async function WithdrawPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) return null

  const affiliate = await getOwnAffiliate(payload, user.id)
  if (!affiliate) {
    return (
      <div className="bg-white rounded-2xl border border-cream-200 p-8 text-center">
        <p className="text-sm text-muted-foreground">您的帳號尚未建立合作夥伴分潤資料。</p>
      </div>
    )
  }

  const history = (affiliate.withdrawalRequests || [])
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id || `${r.requestedAt}-${r.amount}`,
      date: r.requestedAt ? new Date(r.requestedAt).toLocaleDateString('zh-TW') : '',
      amount: r.amount,
      status: r.status || 'pending',
    }))

  return (
    <WithdrawClient
      withdrawableAmount={affiliate.withdrawableAmount || 0}
      bankInfo={{
        bankName: affiliate.bankInfo?.bankName || '',
        branchName: affiliate.bankInfo?.branchName || '',
        accountNumber: affiliate.bankInfo?.accountNumber || '',
        accountHolder: affiliate.bankInfo?.accountHolder || '',
      }}
      history={history}
      affiliateId={affiliate.id}
    />
  )
}
