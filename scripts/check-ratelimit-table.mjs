import { neon } from '@neondatabase/serverless'

const sql = neon('process.env.DATABASE_URL')

// Check if RateLimit table exists
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'RateLimit'
`
console.log('RateLimit table exists:', tables.length > 0)

if (tables.length > 0) {
  const rows = await sql`SELECT * FROM "RateLimit" ORDER BY "lastAttemptAt" DESC LIMIT 20`
  console.log('Rows:', rows.length)
  rows.forEach(r => console.log(`  ${r.key} | count=${r.count} | first=${r.firstAttemptAt} | last=${r.lastAttemptAt}`))
} else {
  console.log('\nTable does NOT exist. The schema initialization in distributed-rate-limit.ts is failing.')
  console.log('Checking what tables exist:')
  const allTables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  allTables.forEach(t => console.log(`  - ${t.table_name}`))
}
