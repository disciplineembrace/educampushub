import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { hashPassword } from '@/lib/admin-auth'

/**
 * Database initialization endpoint.
 * Uses Neon serverless driver (HTTP) instead of Prisma (TCP) for reliable
 * serverless connectivity. This creates tables and seeds the admin user.
 * 
 * Secured with a hardcoded secret to prevent unauthorized access.
 */
const INIT_SECRET = 'EduCampusHub-Init-2024-Secure'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const secret = body.secret || ''
    
    if (secret !== INIT_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get a fresh Neon SQL connection for this request
    const sql = getNeonSql()
    const results: string[] = []

    // 1. Create PasswordResetOTP table if not exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS "PasswordResetOTP" (
          "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" TEXT NOT NULL,
          "phone" TEXT NOT NULL,
          "otpCode" TEXT NOT NULL,
          "isVerified" BOOLEAN NOT NULL DEFAULT false,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "usedAt" TIMESTAMP(3)
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS "PasswordResetOTP_email_idx" ON "PasswordResetOTP"("email")`
      await sql`CREATE INDEX IF NOT EXISTS "PasswordResetOTP_otpCode_idx" ON "PasswordResetOTP"("otpCode")`
      await sql`CREATE INDEX IF NOT EXISTS "PasswordResetOTP_expiresAt_idx" ON "PasswordResetOTP"("expiresAt")`
      results.push('✅ PasswordResetOTP table ready')
    } catch (tableError: any) {
      results.push(`❌ PasswordResetOTP table error: ${tableError.message?.substring(0, 150)}`)
    }

    // 2. Seed/Update Super Admin user
    const adminEmail = 'sagathiyapradip2002@gmail.com'
    const adminPassword = '@deval1808'
    const adminPhone = '9974331007'

    try {
      const hash = await hashPassword(adminPassword)
      
      // Check if admin exists
      const existing = await sql`
        SELECT id, "isAdmin", "isSuperAdmin" FROM "User" WHERE email = ${adminEmail}
      `
      
      if (existing.length > 0) {
        // Update existing user to Super Admin
        await sql`
          UPDATE "User" SET 
            "isAdmin" = true,
            "adminRole" = 'super_admin',
            "isSuperAdmin" = true,
            "twoFactorEnabled" = true,
            "passwordHash" = ${hash},
            "mustChangePassword" = false,
            "isVerified" = true,
            phone = ${adminPhone},
            name = 'Super Admin',
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE email = ${adminEmail}
        `
        results.push(`✅ Super Admin updated: ${adminEmail} / phone: ${adminPhone} / 2FA: enabled`)
      } else {
        // Create Super Admin user
        await sql`
          INSERT INTO "User" (id, email, name, "isAdmin", "adminRole", "isSuperAdmin", "twoFactorEnabled", "passwordHash", "mustChangePassword", "isVerified", phone, city, "freeUploadUsed", "paidUploadCredits", "totalBooksUploaded", rating, "totalSales", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${adminEmail}, 'Super Admin', true, 'super_admin', true, true, ${hash}, false, true, ${adminPhone}, 'Delhi', 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
        results.push(`✅ Super Admin created: ${adminEmail} / phone: ${adminPhone} / 2FA: enabled`)
      }

      // Ensure no other user has isSuperAdmin = true
      await sql`
        UPDATE "User" SET "isSuperAdmin" = false WHERE email != ${adminEmail} AND "isSuperAdmin" = true
      `

      // Demote legacy admin to moderator if exists
      const legacyEmail = 'disciplineembrace@gmail.com'
      const legacyAdmin = await sql`
        SELECT id FROM "User" WHERE email = ${legacyEmail} AND "isAdmin" = true AND "isSuperAdmin" = false
      `
      if (legacyAdmin.length > 0) {
        await sql`
          UPDATE "User" SET "adminRole" = 'moderator', "twoFactorEnabled" = false WHERE email = ${legacyEmail}
        `
        results.push(`✅ Legacy admin ${legacyEmail} demoted to moderator`)
      }
    } catch (adminError: any) {
      results.push(`❌ Admin user error: ${adminError.message?.substring(0, 150)}`)
    }

    // 3. Test database connectivity
    try {
      const userResult = await sql`SELECT COUNT(*)::int as count FROM "User"`
      const listingResult = await sql`SELECT COUNT(*)::int as count FROM "Listing"`
      results.push(`✅ DB connected: ${userResult[0]?.count || 0} users, ${listingResult[0]?.count || 0} listings`)
    } catch (dbError: any) {
      results.push(`❌ DB connectivity error: ${dbError.message?.substring(0, 150)}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('DB init error:', error)
    return NextResponse.json({ 
      error: 'Initialization failed', 
      details: error.message 
    }, { status: 500 })
  }
}
