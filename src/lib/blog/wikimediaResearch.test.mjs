import assert from 'node:assert/strict'
import test from 'node:test'

const {
  getCommonsImageCandidate,
  isWhitelistedCommonsLicense,
  isSafeCommonsDownloadUrl,
  normalizeCommonsCandidate,
  researchKpopTopic,
} = await import('./wikimediaResearch.ts')

test('accepts Commons licenses that allow promotional reuse and rejects NC/unknown', () => {
  assert.equal(isWhitelistedCommonsLicense('CC0'), true)
  assert.equal(isWhitelistedCommonsLicense('Public domain'), true)
  assert.equal(isWhitelistedCommonsLicense('CC BY 4.0'), true)
  assert.equal(isWhitelistedCommonsLicense('CC BY-SA 3.0'), true)
  assert.equal(isWhitelistedCommonsLicense('CC BY-NC 4.0'), false)
  assert.equal(isWhitelistedCommonsLicense('All rights reserved'), false)
})

test('normalizes Commons metadata and removes HTML from attribution', () => {
  const candidate = normalizeCommonsCandidate({
    title: 'File:IVE example.jpg',
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/example-original.jpg',
        thumburl: 'https://upload.wikimedia.org/example-1000px.jpg',
        mime: 'image/jpeg',
        width: 2000,
        height: 1333,
        extmetadata: {
          Artist: { value: '<a href="/wiki/User:Example">Example User</a>' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
          Credit: { value: 'Own work' },
          ObjectName: { value: 'IVE at an event' },
        },
      },
    ],
  })

  assert.equal(candidate.creator, 'Example User')
  assert.equal(candidate.licenseKind, 'cc-by-sa')
  assert.equal(candidate.width, 2000)
  assert.match(candidate.sourceUrl, /commons\.wikimedia\.org/)
})

test('returns source text and only rights-whitelisted Commons candidates', async () => {
  const calls = []
  const fakeFetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('zh.wikipedia.org')) {
      return Response.json({
        query: {
          pages: [
            {
              title: 'IVE',
              fullurl: 'https://zh.wikipedia.org/wiki/IVE',
              extract: 'IVE 是韓國女子音樂團體。',
            },
          ],
        },
      })
    }
    return Response.json({
      query: {
        pages: [
          {
            title: 'File:IVE licensed.jpg',
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/licensed.jpg',
                thumburl: 'https://upload.wikimedia.org/licensed-1000px.jpg',
                mime: 'image/jpeg',
                width: 1600,
                height: 1067,
                extmetadata: {
                  Artist: { value: 'Licensed User' },
                  LicenseShortName: { value: 'CC BY 4.0' },
                  LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
                },
              },
            ],
          },
          {
            title: 'File:IVE noncommercial.jpg',
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/noncommercial.jpg',
                mime: 'image/jpeg',
                width: 1200,
                height: 800,
                extmetadata: {
                  Artist: { value: 'NC User' },
                  LicenseShortName: { value: 'CC BY-NC 4.0' },
                  LicenseUrl: { value: 'https://creativecommons.org/licenses/by-nc/4.0/' },
                },
              },
            ],
          },
          {
            title: 'File:IVE missing license link.jpg',
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/missing-license-link.jpg',
                mime: 'image/jpeg',
                width: 1200,
                height: 800,
                extmetadata: {
                  Artist: { value: 'Incomplete Attribution User' },
                  LicenseShortName: { value: 'CC BY 4.0' },
                },
              },
            ],
          },
        ],
      },
    })
  }

  const result = await researchKpopTopic('IVE', { fetchImpl: fakeFetch })

  assert.equal(result.sources.length, 1)
  assert.equal(result.images.length, 1)
  assert.equal(result.images[0].creator, 'Licensed User')
  assert.equal(calls.length, 2)
})

test('refreshes an exact Commons file before import and restricts download hosts', async () => {
  const fakeFetch = async () =>
    Response.json({
      query: {
        pages: [
          {
            title: 'File:IVE licensed.jpg',
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/licensed.jpg',
                thumburl: 'https://upload.wikimedia.org/licensed-1000px.jpg',
                mime: 'image/jpeg',
                width: 1600,
                height: 1067,
                extmetadata: {
                  Artist: { value: 'Licensed User' },
                  LicenseShortName: { value: 'CC BY 4.0' },
                  LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
                },
              },
            ],
          },
        ],
      },
    })

  const candidate = await getCommonsImageCandidate(
    'File:IVE licensed.jpg',
    { fetchImpl: fakeFetch },
  )
  assert.equal(candidate.licenseKind, 'cc-by')
  assert.equal(isSafeCommonsDownloadUrl(candidate.downloadUrl), true)
  assert.equal(
    isSafeCommonsDownloadUrl('https://upload.wikimedia.org.evil.example/photo.jpg'),
    false,
  )
  assert.equal(isSafeCommonsDownloadUrl('http://127.0.0.1/photo.jpg'), false)
})
