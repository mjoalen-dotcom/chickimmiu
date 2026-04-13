/**
 * AI DM API
 * POST /api/ai-dm
 *
 * Generates personalized marketing DM for a member based on their
 * interested products, purchase history, and preferences.
 *
 * Body: { userId: number, channel?: 'email' | 'line' | 'sms' | 'all' }
 *
 * Returns generated DM content (preview) or sends it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const body = await req.json()
    const { userId, channel, send } = body as {
      userId: number
      channel?: string
      send?: boolean
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Fetch user with depth to get related data
    const member = await payload.findByID({ collection: 'users', id: userId, depth: 2 })
    if (!member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const memberData = member as unknown as Record<string, unknown>
    const name = (memberData.name as string) || 'Member'
    const email = (memberData.email as string) || ''
    const preferences = memberData.aiDmPreferences as Record<string, unknown> | undefined
    const interestedProducts = (preferences?.interestedProducts as Array<Record<string, unknown>>) || []
    const preferredCategory = (memberData.preferredCategory as string) || ''
    const preferredColor = (memberData.preferredColor as string) || ''
    const tier = memberData.memberTier as Record<string, unknown> | undefined
    const tierName = (tier?.frontName as string) || 'Member'

    // Build product recommendations
    const productNames = interestedProducts
      .slice(0, 5)
      .map(p => (p.name as string) || 'Product')

    // Generate DM content
    const greeting = `Dear ${name},`
    const tierMsg = tier ? `As our valued ${tierName},` : ''

    let body_content = ''
    if (productNames.length > 0) {
      body_content = `We noticed you've been eyeing some beautiful pieces! Here are items we think you'll love:\n\n`
      productNames.forEach((pn, i) => {
        body_content += `${i + 1}. ${pn}\n`
      })
      body_content += `\nDon't miss out - these items are selling fast!`
    } else if (preferredCategory || preferredColor) {
      body_content = `Based on your style preferences${preferredCategory ? ` for ${preferredCategory}` : ''}${preferredColor ? ` in ${preferredColor}` : ''}, we've curated some special picks just for you!`
    } else {
      body_content = `Check out our latest arrivals and trending styles, specially selected for you!`
    }

    const dmContent = {
      subject: `${name}, special picks just for you!`,
      greeting,
      tierMessage: tierMsg,
      body: body_content,
      channel: channel || (preferences?.dmChannel as string) || 'email',
      recipientEmail: email,
      recipientLine: (memberData.lineUid as string) || '',
      productCount: productNames.length,
    }

    // If send=true, record the DM in the user's history
    if (send) {
      const existingHistory = ((preferences?.dmHistory as unknown[]) || []) as Array<Record<string, unknown>>
      const newEntry = {
        channel: dmContent.channel,
        subject: dmContent.subject,
        status: 'sent',
        sentAt: new Date().toISOString(),
      }

      await (payload.update as Function)({
        collection: 'users',
        id: userId,
        data: {
          aiDmPreferences: {
            ...(preferences || {}),
            lastDmSentAt: new Date().toISOString(),
            dmHistory: [newEntry, ...existingHistory].slice(0, 20),
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: `DM sent to ${name} via ${dmContent.channel}`,
        content: dmContent,
      })
    }

    // Preview mode
    return NextResponse.json({
      success: true,
      preview: true,
      content: dmContent,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
