import prisma from "~/server/utils/prisma";
import { serverSupabaseClient } from "#supabase/server";
import { z } from "zod";
import { createError, readBody } from "h3";
import { Prisma } from "@prisma/client";

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6),
});

export default defineEventHandler(async (event) => {
  try {
    // Parse + validate
    const body = await readBody(event);
    const parsed = signupSchema.parse(body);

    // Normalize
    const email = parsed.email.trim().toLowerCase();
    const username = parsed.username.trim().toLowerCase();
    const password = parsed.password;

    // Optional pre-checks (good UX; DB constraints still required)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      select: { id: true, username: true, email: true },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw createError({
          statusCode: 400,
          statusMessage: "Username already taken",
        });
      }

      if (existingUser.email === email) {
        throw createError({
          statusCode: 400,
          statusMessage: "Email is already registered",
        });
      }
    }

    // Create auth user in Supabase
    const supabase = await serverSupabaseClient(event);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      // Avoid leaking too much detail; map common cases if desired
      throw createError({
        statusCode: 400,
        statusMessage: authError.message || "Failed to create auth account",
      });
    }

    if (!authData.user?.id) {
      throw createError({
        statusCode: 500,
        statusMessage: "Signup failed: no user returned from auth provider",
      });
    }

    // Create app user row
    await prisma.user.create({
      data: {
        id: authData.user.id,
        email,
        username,
      },
    });

    // Success
    return {
      success: true,
      message: "Account created! Check your email to verify.",
    };
  } catch (error: any) {
    // h3 errors (already formatted)
    if (error?.statusCode) {
      throw error;
    }

    // Zod validation
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Validation failed",
        data: { details: error.issues },
      });
    }

    // Prisma unique constraint fallback (race condition safety)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Username or email already exists",
      });
    }

    console.error("Signup route error:", error);

    throw createError({
      statusCode: 500,
      statusMessage: "Signup failed",
    });
  }
});