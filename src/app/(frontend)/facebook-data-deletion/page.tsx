import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Facebook 登入資料刪除說明',
  description: '申請移除 CHIC KIM & MIU 保存的 Facebook 登入連結與會員資料。',
}

export default function FacebookDataDeletionPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F3] py-16 px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white border border-[#E5DED4] p-8 md:p-12 space-y-7">
        <div>
          <p className="text-sm tracking-[0.25em] text-[#C19A5B]">CHIC KIM &amp; MIU</p>
          <h1 className="mt-2 text-3xl font-serif">Facebook 登入資料刪除說明</h1>
        </div>
        <p className="leading-8 text-foreground/75">
          我們只使用 Facebook 提供的應用程式範圍識別碼與顯示名稱來完成登入，不保存 Facebook 密碼，也不索取朋友名單。您可以申請移除 Facebook 登入連結，或依隱私權政策申請刪除會員資料。
        </p>
        <section>
          <h2 className="text-xl font-medium">如何提出申請</h2>
          <ol className="mt-3 list-decimal pl-6 space-y-2 text-foreground/75 leading-7">
            <li>使用其他已連結方式登入會員中心，確認要處理的帳號。</li>
            <li>由註冊信箱寄信至 <Link className="text-[#A77A35] underline" href="mailto:service@chickimmiu.com?subject=Facebook%20登入資料刪除申請">service@chickimmiu.com</Link>，主旨填「Facebook 登入資料刪除申請」。</li>
            <li>客服完成身分核對後，會告知可移除的資料、法令或交易保存義務，以及處理結果。</li>
          </ol>
        </section>
        <p className="text-sm text-foreground/75 leading-7">
          如果您沒有綁定信箱、無法登入，或 Facebook 是唯一登入方式，請由<Link href="/contact" className="text-[#A77A35] underline">聯絡客服</Link>提出申請，讓客服協助核對帳號。請勿寄送 Facebook 密碼、驗證碼或存取權杖。
        </p>
        <p className="rounded-xl bg-[#F7F0E7] p-4 text-sm leading-6 text-foreground/70">
          只移除 Facebook 連結後，您需要使用其他已設定的登入方式進入會員；若要求刪除整個會員帳號，必要的訂單、會計或爭議處理資料可能依法律規定保留。
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/privacy-policy" className="text-[#A77A35] underline">隱私權政策</Link>
          <Link href="/contact" className="text-[#A77A35] underline">聯絡客服</Link>
        </div>
      </article>
    </main>
  )
}
