/**
 * One-off migration script: add security question columns to the "User" table.
 *
 * Run with:
 *   npx tsx scripts/migrate-security-question.ts
 *
 * Safe to re-run (uses IF NOT EXISTS).
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { neon } from '@neondatabase/serverless'

config({ path: resolve(process.cwd(), '.env'), override: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
  console.error('ERROR: DATABASE_URL is not set or invalid.')
  process.exit(1)
}

const sql = neon(databaseUrl)

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
  `
  return rows.length > 0
}

async function main() {
  console.log('Checking User table for security question columns...')

  // 1. securityQuestionIdx (Int?, nullable)
  if (!(await columnExists('User', 'securityQuestionIdx'))) {
    console.log('  + Adding column: "User"."securityQuestionIdx" (Int?)')
    await sql`ALTER TABLE "User" ADD COLUMN "securityQuestionIdx" INTEGER`
  } else {
    console.log('  ✓ Already exists: "User"."securityQuestionIdx"')
  }

  // 2. securityAnswerHash (Text?, nullable)
  if (!(await columnExists('User', 'securityAnswerHash'))) {
    console.log('  + Adding column: "User"."securityAnswerHash" (Text?)')
    await sql`ALTER TABLE "User" ADD COLUMN "securityAnswerHash" TEXT`
  } else {
    console.log('  ✓ Already exists: "User"."securityAnswerHash"')
  }

  // 3. securityAttempts (Int, default 0)
  if (!(await columnExists('User', 'securityAttempts'))) {
    console.log('  + Adding column: "User"."securityAttempts" (Int, default 0)')
    await sql`ALTER TABLE "User" ADD COLUMN "securityAttempts" INTEGER NOT NULL DEFAULT 0`
  } else {
    console.log('  ✓ Already exists: "User"."securityAttempts"')
  }

  // 4. securityLockedUntil (Timestamp?, nullable)
  if (!(await columnExists('User', 'securityLockedUntil'))) {
    console.log('  + Adding column: "User"."securityLockedUntil" (Timestamp?)')
    await sql`ALTER TABLE "User" ADD COLUMN "securityLockedUntil" TIMESTAMP(3)`
  } else {
    console.log('  ✓ Already exists: "User"."securityLockedUntil"')
  }

  // 5. securityUpdatedAt (Timestamp?, nullable)
  if (!(await columnExists('User', 'securityUpdatedAt'))) {
    console.log('  + Adding column: "User"."securityUpdatedAt" (Timestamp?)')
    await sql`ALTER TABLE "User" ADD COLUMN "securityUpdatedAt" TIMESTAMP(3)`
  } else {
    console.log('  ✓ Already exists: "User"."securityUpdatedAt"')
  }

  console.log('\n✅ Migration complete.')
}

main()
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
