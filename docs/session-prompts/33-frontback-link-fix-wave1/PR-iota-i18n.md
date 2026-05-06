# Wave 1 PR-ι — i18n 補翻譯（admin 新欄位 + storefront hardcoded）

**Branch**: `claude/wave1-i18n-storefront-admin`
**Date**: 2026-05-06
**Wave**: 1（與 α/β/γ/δ/ε/ζ/θ 平行）

---

## Background

PR #174 已建 next-intl + 5 語系（zh-Hant / en / ja / ko / zh-Hans）+ Navbar/Footer/Hero/ProductCard 翻譯。但：

1. **PLP `ProductListClient.tsx` 還有大量 hardcoded 中文**（PRODUCTS / 全部商品 / 商品分類 / 全部分類 / 更多篩選 / 件商品 / 顏色 / 價格範圍 / 尺寸 / 目前沒有符合條件的商品 / 清除篩選條件 / TAG_OPTIONS / SORT_OPTIONS）
2. PR-α/β 即將加 admin field，admin 端 label 中文 hardcoded — 不在本 PR scope（admin label 不走 i18n，用 Payload field label 中文即可）

實際 scope：**PR-ι 只補 storefront PLP + collections + category 文案到 5 語系字典**。新 admin global 的 label 是 hardcoded 中文 OK，不動。

---

## Goal

1. 把 PLP/Category/Collections 頁的 hardcoded 中文集中到 `productList.*` namespace 與 `category.*` namespace
2. 5 語系字典補對應 key（en/ja/ko/zh-Hans 由 user 後續審或機翻；本 PR 給 baseline）
3. **不動 ProductListClient.tsx 渲染**（Wave 2 PR-κ 會接 t() 用）。PR-ι 只負責**字典準備好**

---

## Files

### Edit
- `src/messages/zh-Hant.json` — 加 namespace
- `src/messages/zh-Hans.json` — 加 namespace
- `src/messages/en.json` — 加
- `src/messages/ja.json` — 加
- `src/messages/ko.json` — 加

### Do NOT touch
- `ProductListClient.tsx`（Wave 2）
- `collections/page.tsx` / `collections/[slug]/page.tsx`（Wave 2 PR-λ）
- 任何 admin component
- 新 globals 的 label（PR-α/β 用中文 hardcoded）

---

## Translation skeleton（zh-Hant 為 source of truth）

```jsonc
{
  "productList": {
    "overline": "PRODUCTS",
    "title": "全部商品",
    "categoryNav": {
      "label": "商品分類",
      "all": "全部分類",
      "allOf": "全部 {name}"
    },
    "tags": {
      "all": "全部",
      "new": "新品上市",
      "hot": "熱銷推薦",
      "sale": "限時優惠",
      "koreanCelebrity": "★ 韓星同款",
      "jinStyle": "✿ 金老佛爺已穿"
    },
    "sort": {
      "newest": "最新上架",
      "priceAsc": "價格：低到高",
      "priceDesc": "價格：高到低",
      "popular": "人氣推薦"
    },
    "filters": {
      "more": "更多篩選",
      "clear": "清除篩選",
      "color": "顏色",
      "priceRange": "價格範圍",
      "size": "尺寸",
      "minPlaceholder": "NT$ 0",
      "maxPlaceholder": "NT$ 10,000"
    },
    "count": "{n} 件商品",
    "empty": {
      "title": "目前沒有符合條件的商品",
      "cta": "清除篩選條件"
    },
    "pagination": {
      "previous": "上一頁",
      "next": "下一頁",
      "page": "第 {n} 頁",
      "of": "共 {total} 頁"
    }
  },
  "category": {
    "overline": "CATEGORY",
    "empty": "此分類目前沒有商品",
    "breadcrumb": {
      "home": "首頁",
      "products": "全部商品"
    }
  },
  "collections": {
    "heroOverline": "Collection",
    "heroTitle": "主題精選",
    "heroDescription": "依風格、場合、主題瀏覽我們為您精心策劃的系列",
    "browse": "瀏覽系列 →",
    "empty": {
      "title": "此系列目前尚無商品，敬請期待",
      "cta": "瀏覽全部商品"
    }
  }
}
```

### en.json baseline（user 之後審）

```jsonc
{
  "productList": {
    "overline": "PRODUCTS",
    "title": "All Products",
    "categoryNav": {
      "label": "Categories",
      "all": "All Categories",
      "allOf": "All {name}"
    },
    "tags": {
      "all": "All",
      "new": "New Arrivals",
      "hot": "Bestsellers",
      "sale": "On Sale",
      "koreanCelebrity": "★ K-Celeb Style",
      "jinStyle": "✿ Jin's Picks"
    },
    "sort": {
      "newest": "Newest",
      "priceAsc": "Price: Low to High",
      "priceDesc": "Price: High to Low",
      "popular": "Popular"
    },
    "filters": {
      "more": "More Filters",
      "clear": "Clear Filters",
      "color": "Color",
      "priceRange": "Price Range",
      "size": "Size",
      "minPlaceholder": "NT$ 0",
      "maxPlaceholder": "NT$ 10,000"
    },
    "count": "{n} items",
    "empty": {
      "title": "No products match your filters",
      "cta": "Clear filters"
    },
    "pagination": {
      "previous": "Previous",
      "next": "Next",
      "page": "Page {n}",
      "of": "of {total}"
    }
  },
  "category": {
    "overline": "CATEGORY",
    "empty": "No products in this category yet",
    "breadcrumb": { "home": "Home", "products": "All Products" }
  },
  "collections": {
    "heroOverline": "Collection",
    "heroTitle": "Curated Collections",
    "heroDescription": "Browse our curated themes by style, occasion, and inspiration",
    "browse": "Browse →",
    "empty": {
      "title": "This collection is empty for now — stay tuned",
      "cta": "Browse All Products"
    }
  }
}
```

### ja / ko / zh-Hans

走機翻 baseline，user 之後審。

---

## Acceptance

- [ ] 5 個 `src/messages/*.json` 都有 `productList`、`category`、`collections` 三個 namespace
- [ ] JSON valid（`pnpm tsc --noEmit` 不會炸 next-intl typed messages）
- [ ] 沒新增其他 namespace（避免 scope creep）
- [ ] **沒動任何 .tsx**（這 PR 純字典）

## Out of scope

- 不接 t() 到 ProductListClient（Wave 2 PR-κ 做）
- 不翻 admin label
- 不翻 cart/checkout（另案）
