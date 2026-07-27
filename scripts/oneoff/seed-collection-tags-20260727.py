#!/usr/bin/env python3
"""LB-09：七個導覽主題系列綁真商品（2026-07-27 一次性資料腳本）。

在 prod 直接對 products_collection_tags 寫入（單表、可重跑）：
  rush            ← Shopline tag「現貨速到專區 Rush」
  formal-dresses  ← category 28 婚禮/正式場合洋裝系列 ∪ tags 正式洋裝/正式場合洋裝/婚禮穿搭/婚禮外套
  celebrity-style ← tag 韓劇穿搭 ∪ 舊站韓劇/韓星分類（she-was-pretty 等，名稱比對）
  jin-style       ← 舊站 kimlafayetteoutfit（金老佛爺穿搭專區，名稱比對）
  brand-custom    ← 舊站 dark-angel-x-ckmu ∪ tag 自訂款
  jin-live        ← tags 金老佛爺%（團購/廚房/褲）∪ 連線直播
  host-style      ← tag 主播同款專區 ∪ category 36 職場穿搭

同時移除 demo 商品（id 1–9）先前的暫時 collectionTags。
用法：python3 seed-collection-tags-20260727.py <db> <oldsite_names.json> [--apply]
（不帶 --apply 為 dry-run，只列印會寫入的結果。）
"""
import json
import re
import sqlite3
import sys

DB, NAMES_JSON = sys.argv[1], sys.argv[2]
APPLY = '--apply' in sys.argv

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

oldsite = json.load(open(NAMES_JSON, encoding='utf-8'))

CJK = re.compile(r'[　-鿿！-｠]')


def ids_by_tag(patterns, like=False):
    ids = set()
    for p in patterns:
        if like:
            rows = cur.execute(
                "SELECT DISTINCT t._parent_id FROM products_tags t "
                "JOIN products p ON p.id=t._parent_id "
                "WHERE p.status='published' AND t.tag LIKE ?", (p,))
        else:
            rows = cur.execute(
                "SELECT DISTINCT t._parent_id FROM products_tags t "
                "JOIN products p ON p.id=t._parent_id "
                "WHERE p.status='published' AND t.tag = ?", (p,))
        ids.update(r[0] for r in rows)
    return ids


def ids_by_category(cat_ids):
    ids = set()
    for c in cat_ids:
        rows = cur.execute(
            "SELECT id FROM products WHERE status='published' AND category_id=?", (c,))
        ids.update(r[0] for r in rows)
    return ids


def ids_by_name_like(pattern):
    rows = cur.execute(
        "SELECT id FROM products WHERE status='published' AND name LIKE ?", (pattern,))
    return {r[0] for r in rows}


def ids_by_oldsite(cat_keys):
    """舊站 handle 片段 → 商品比對：CJK 長 token 用 name LIKE；純英文用 slug。"""
    ids = set()
    for key in cat_keys:
        for frag in oldsite.get(key, []):
            tokens = frag.split()
            cjk_tokens = [t for t in tokens if CJK.search(t) and len(t) >= 3]
            if cjk_tokens:
                # 全部 CJK token AND 起來（通常只有 1 個長 token）
                sql = ("SELECT id FROM products WHERE status='published' AND "
                       + ' AND '.join(['name LIKE ?'] * len(cjk_tokens)))
                rows = cur.execute(sql, tuple(f'%{t}%' for t in cjk_tokens))
                ids.update(r[0] for r in rows)
            else:
                slug = '-'.join(tokens).lower()
                if len(slug) < 6:
                    continue  # e1901003 這類 SKU 代碼跳過
                rows = cur.execute(
                    "SELECT id FROM products WHERE status='published' AND "
                    "(slug = ? OR slug LIKE ?)", (slug, slug + '-%'))
                ids.update(r[0] for r in rows)
    return ids


plan = {
    'rush': ids_by_tag(['現貨速到專區 Rush']),
    'formal-dresses': ids_by_category([28]) | ids_by_tag(
        ['正式洋裝', '正式場合洋裝', '婚禮穿搭', '婚禮外套']),
    'celebrity-style': ids_by_tag(['韓劇穿搭']) | ids_by_oldsite(
        ['she-was-pretty', 'the-producers', 'whatswrongwithsecretarykim',
         'korean-drama-acc', 'korean-star-love']),
    'jin-style': ids_by_oldsite(['kimlafayetteoutfit']),
    'brand-custom': ids_by_oldsite(['dark-angel-x-ckmu']) | ids_by_tag(['自訂款']),
    'jin-live': ids_by_tag(['金老佛爺%'], like=True)
        | ids_by_tag(['%連線直播%'], like=True)
        | ids_by_name_like('%連線直播%'),
    'host-style': ids_by_tag(['主播同款專區']) | ids_by_category([36]),
}

# demo 商品（id 1–9）不入任何系列
DEMO_MAX = 9
for k in plan:
    plan[k] = {i for i in plan[k] if i > DEMO_MAX}

for k, ids in sorted(plan.items()):
    print(f'== {k}: {len(ids)} 件')
    for r in cur.execute(
            f"SELECT id, substr(name,1,45) FROM products WHERE id IN ({','.join(map(str, ids)) or '0'}) LIMIT 8"):
        print(f'   {r[0]:>5}  {r[1]}')

if not APPLY:
    print('\n(dry-run，未寫入。加 --apply 才會寫。)')
    sys.exit(0)

# 移除 demo 商品的暫時 tags + 重建
deleted = cur.execute(
    "DELETE FROM products_collection_tags WHERE parent_id <= ?", (DEMO_MAX,)).rowcount

# product → [tags]，order 依插入序
per_product = {}
for tag, ids in plan.items():
    for pid in ids:
        per_product.setdefault(pid, []).append(tag)

inserted = 0
for pid, tags in per_product.items():
    existing = {r[0] for r in cur.execute(
        "SELECT value FROM products_collection_tags WHERE parent_id=?", (pid,))}
    start = cur.execute(
        "SELECT COALESCE(MAX(\"order\"),0) FROM products_collection_tags WHERE parent_id=?",
        (pid,)).fetchone()[0]
    for n, tag in enumerate(t for t in tags if t not in existing):
        cur.execute(
            'INSERT INTO products_collection_tags ("order", parent_id, value) VALUES (?,?,?)',
            (start + n + 1, pid, tag))
        inserted += 1

conn.commit()
print(f'\n已寫入：刪 demo tags {deleted} 列、新增 {inserted} 列。')
for r in cur.execute(
        "SELECT value, count(*) FROM products_collection_tags GROUP BY value ORDER BY value"):
    print(f'   {r[0]}: {r[1]}')
