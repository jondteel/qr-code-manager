import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'




const createQrSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  data: z.string().min(1), // The URL or content
  size: z.number().min(128).max(1024).default(300),
  fgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
  errorLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  createShortUrl: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const user = await serverSupabaseUser(event)
    if (!user) {
      return {
        error: 'Unauthorized',
        statusCode: 401
      }
    }

    // Parse and validate
    const body = await readBody(event)
    const validatedData = createQrSchema.parse(body)

    // Create QR code in database
    const qrCode = await prisma.qRCode.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        data: validatedData.data,
        size: validatedData.size,
        fgColor: validatedData.fgColor,
        bgColor: validatedData.bgColor,
        errorLevel: validatedData.errorLevel,
        userId: user.id,
      }
    })

    // If short URL requested, create it
    let shortUrl = null
    if (validatedData.createShortUrl) {
      // Generate unique short code
      const shortCode = await generateUniqueShortCode()
      
      shortUrl = await prisma.shortUrl.create({
        data: {
          shortCode,
          originalUrl: validatedData.data,
          userId: user.id,
        }
      })

      // Link QR code to short URL
      await prisma.qRCode.update({
        where: { id: qrCode.id },
        data: { shortUrlId: shortUrl.id }
      })
    }

    return {
      success: true,
      qrCode,
      shortUrl,
      statusCode: 201
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        error: 'Validation failed',
        details: error.issues,
        statusCode: 400
      }
    }

    console.error('QR creation error:', error)
    return {
      error: error?.message || 'Failed to create QR code',
      statusCode: 500
    }
  }
})

// Generate unique short code with collision prevention
async function generateUniqueShortCode(): Promise<string> {
  const maxAttempts = 10
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = nanoid(8) // 8 chars, URL-safe
    
    // Check if this code already exists
    const existing = await prisma.shortUrl.findUnique({
      where: { shortCode: code }
    })
    
    if (!existing) {
      return code // Found a unique one!
    }
    
    // If we somehow get a collision (extremely rare), try again
    console.warn(`Short code collision detected on attempt ${attempt + 1}`)
  }
  
  throw new Error('Failed to generate unique short code after multiple attempts')
}