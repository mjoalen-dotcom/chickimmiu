import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'

import { GET } from './route'

test('iframe 一律沿用 embed.js 的公開來源，不信任反向代理產生的 localhost URL', async () => {
  const response = GET()
  const loader = await response.text()
  const inserted: Array<Record<string, unknown>> = []
  const target = {
    insertBefore(node: Record<string, unknown>) {
      inserted.push(node)
    },
  }
  const script = {
    src: 'https://pre.chickimmiu.com/embed.js',
    parentElement: target,
    nextSibling: null,
    getAttribute(name: string) {
      if (name === 'data-widget') return 'kim-lafayette-demo'
      if (name === 'data-title') return 'WallGather 比較版'
      return null
    },
  }
  const document = {
    currentScript: script,
    body: target,
    createElement(tagName: string) {
      return {
        tagName,
        style: {},
        setAttribute() {},
      }
    },
  }
  const window = {
    location: { host: 'blog.kimlafayette.com' },
    addEventListener() {},
  }
  let requestedUrl = ''
  const fetch = async (url: string) => {
    requestedUrl = url
    return {
      ok: true,
      async json() {
        return {
          token: 'signed-token',
          expiresIn: 300,
          embedUrl: 'https://localhost:3000/embed/kim-lafayette-demo?token=signed-token',
        }
      },
    }
  }

  vm.runInNewContext(loader, { document, fetch, URL, window })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(
    requestedUrl,
    'https://pre.chickimmiu.com/api/social-wall/embed-token?widget=kim-lafayette-demo&host=blog.kimlafayette.com',
  )
  const iframe = inserted.find((node) => node.tagName === 'iframe')
  assert.ok(iframe)
  assert.equal(
    iframe.src,
    'https://pre.chickimmiu.com/embed/kim-lafayette-demo?token=signed-token&host=blog.kimlafayette.com',
  )
})
