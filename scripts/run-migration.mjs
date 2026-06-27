import { neon } from '@neondatabase/serverless'

const databaseUrl = 'process.env.DATABASE_URL'

const sql = neon(databaseUrl)

async function columnExists(tableName, columnName) {
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
  console.log('Connected to Neon. Checking User table for security question columns...\n')

  // First check if User table exists at all
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  `
  if (tables.length === 0) {
    console.log('⚠️  "User" table does NOT exist yet. Listing all public tables:')
    const allTables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    allTables.forEach(t => console.log(`   - ${t.table_name}`))
    process.exit(1)
  }
  console.log('✓ "User" table exists.\n')

  const cols = [
    { name: 'securityQuestionIdx', type: 'INTEGER' },
    { name: 'securityAnswerHash', type: 'TEXT' },
    { name: 'securityAttempts', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'securityLockedUntil', type: 'TIMESTAMP(3)' },
    { name: 'securityUpdatedAt', type: 'TIMESTAMP(3)' },
  ]

  for (const col of cols) {
    if (!(await columnExists('User', col.name))) {
      console.log(`  + Adding column: "User"."${col.name}" (${col.type})`)
      await sql(`ALTER TABLE "User" ADD COLUMN "${col.name}" ${col.type}`)
    } else {
      console.log(`  ✓ Already exists: "User"."${col.name}"`)
    }
  }

  // Show final schema
  console.log('\nFinal User table columns:')
  const finalCols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User'
    ORDER BY ordinal_position
  `
  finalCols.forEach(c => console.log(`   - ${c.column_name} (${c.data_type}, nullable=${c.is_nullable}, default=${c.column_default || 'none'})`))

  console.log('\n✅ Migration complete.')
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1) })
