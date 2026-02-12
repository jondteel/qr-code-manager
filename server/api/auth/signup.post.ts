import prisma from '~/server/utils/prisma'
import { serverSupabaseClient } from '#supabase/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6),
})

export default defineEventHandler(async (event) => {
  try {
    // Parse and validate request body
    const body = await readBody(event)
    const validatedData = signupSchema.parse(body)
    
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: validatedData.username }
    })
    
    if (existingUser) {
      return {
        error: 'Username already taken',
        statusCode: 400
      }
    }
    
    // Create auth user with Supabase
    const supabase = await serverSupabaseClient(event)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
    })
    
    if (authError) {
      return {
        error: authError.message,
        statusCode: 400
      }
    }
    
    // Create user in our database
    if (authData.user) {
      await prisma.user.create({
        data: {
          id: authData.user.id,
          email: validatedData.email,
          username: validatedData.username,
        }
      })
    }
    
    return {
      success: true,
      message: 'Account created! Check your email to verify.',
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
    
    return {
      error: error?.message || 'Signup failed',
      statusCode: 500
    }
  }
})