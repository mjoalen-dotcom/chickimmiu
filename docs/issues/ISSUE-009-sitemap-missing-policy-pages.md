# ISSUE-009 — `sitemap.xml` 缺 /about /faq /terms /privacy-policy /return-policy /shopping-guide

**Severity**: P2 Medium（SEO）
**Detected**: 2026-04-18 QA
**Area**: SEO / Sitemap

## 症狀

`GET https://pre.chickimmiu.com/sitemap.xml` 列出 20 條 URL，但不含：
- /about（商店介紹）
- /faq
- /terms
- /privacy-policy
- /return-policy
- /shopping-guide
- /packaging
- /collections
- /membership-benefits 已在內，但其他 globals 驅動的政策頁都缺

所有政策頁都是 content-rich 頁面，對 Google 來說是信任訊號，理應索引。

## 根本原因

檔案 [src/app/sitemap.ts:11-19](src/app/sitemap.ts:11) 只列了 7 條靜態頁：

```ts
const staticPages: MetadataRoute.Sitemap = [
  { url: siteUrl, ... },
  { url: `${siteUrl}/products`, ... },
  { url: `${siteUrl}/blog`, ... },
  { url: `${siteUrl}/membership-benefits`, ... },
  { url: `${siteUrl}/games`, ... },
  { url: `${siteUrl}/login`, ... },
  { url: `${siteUrl}/register`, ... },
]
```

後面有動態補商品 / 部落格 / Pages collection，但政策頁 + FAQ + About 是用 globals（`policy-pages-settings` / `about-page-settings` / `faq-page-settings`）存的，不會自動出現。

## 建議修法

純前端補靜態列表即可，不用動 globals schema：

```ts
const staticPages: MetadataRoute.Sitemap = [
  { url: siteUrl, changeFrequency: 'daily', priority: 1 },
  { url: `${siteUrl}/products`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${siteUrl}/collections`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${siteUrl}/blog`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${siteUrl}/about`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${siteUrl}/faq`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${siteUrl}/membership-benefits`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${siteUrl}/games`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${siteUrl}/login`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${siteUrl}/register`, changeFrequency: 'monthly', priority: 0.3 },
  // 政策頁
  { url: `${siteUrl}/terms`, changeFrequency: 'yearly', priority: 0.4 },
  { url: `${siteUrl}/privacy-policy`, changeFrequency: 'yearly', priority: 0.4 },
  { url: `${siteUrl}/return-policy`, changeFrequency: 'yearly', priority: 0.4 },
  { url: `${siteUrl}/shopping-guide`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${siteUrl}/packaging`, changeFrequency: 'yearly', priority: 0.3 },
]
```

`/account*` / `/checkout*` / `/cart` / `/diag` 不應進 sitemap（noindex）。

## 測試驗收條件

- [ ] `GET /sitemap.xml` 包含上述所有政策頁
- [ ] Google Search Console 可重新 submit sitemap
- [ ] 檢查 `robots.txt` 有指到 sitemap URL

## 估計規模

1 檔 ~20 行，< 5 分鐘
