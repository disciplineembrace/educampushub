import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const PROD = 'https://educampushub.vercel.app'
const EMAIL = 'sagathiyasoya2009@gmail.com'
const TMP_PASSWORD = 'TestPass123!'

async function main() {
  // Step 1: Set a known temporary password directly in DB
  console.log('=== Step 1: Set temporary password in DB ===')
  const hash = await bcrypt.hash(TMP_PASSWORD, 10)
  await db.user.update({
    where: { email: EMAIL },
    data: { passwordHash: hash, mustChangePassword: false },
  })
  console.log(`  ✓ Password set for ${EMAIL}`)

  // Step 2: Login through the real API
  console.log('\n=== Step 2: Login through /api/auth ===')
  const r = await fetch(`${PROD}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email: EMAIL, password: TMP_PASSWORD }),
  })
  console.log(`  HTTP ${r.status}`)
  const setCookie = r.headers.get('set-cookie') || ''
  const tokenMatch = setCookie.match(/session_token=([^;]+)/)
  const token = tokenMatch ? tokenMatch[1] : null
  console.log(`  session_token: ${token ? token.slice(0, 30) + '...' : '(NONE)'}`)
  const data = await r.json()
  console.log(`  body: ${JSON.stringify(data).slice(0, 250)}`)

  if (!token) {
    console.log('\n  → No session cookie set even on successful login!')
    return
  }

  // Step 3: GET security-question (should be 200 with hasSecurityQuestion: false)
  console.log('\n=== Step 3: GET /api/auth/security-question (with cookie) ===')
  const r2 = await fetch(`${PROD}/api/auth/security-question`, {
    headers: { Cookie: `session_token=${token}` },
  })
  console.log(`  HTTP ${r2.status}`)
  const d2 = await r2.json()
  console.log(`  body: ${JSON.stringify(d2).slice(0, 300)}`)

  // Step 4: POST setup with the user's reported inputs (question 6, "Black")
  console.log('\n=== Step 4: POST /api/auth/security-question with action=setup, idx=6, answer=Black ===')
  const r3 = await fetch(`${PROD}/api/auth/security-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `session_token=${token}` },
    body: JSON.stringify({ action: 'setup', securityQuestionIdx: 6, securityAnswer: 'Black' }),
  })
  console.log(`  HTTP ${r3.status}`)
  const d3 = await r3.json()
  console.log(`  body: ${JSON.stringify(d3).slice(0, 300)}`)

  // Step 5: Verify it was saved
  console.log('\n=== Step 5: Verify in DB ===')
  const u = await db.user.findUnique({
    where: { email: EMAIL },
    select: { securityQuestionIdx: true, securityAnswerHash: true, securityUpdatedAt: true },
  })
  console.log(`  securityQuestionIdx: ${u.securityQuestionIdx}`)
  console.log(`  hasAnswerHash: ${u.securityAnswerHash ? 'YES' : 'NO'}`)
  console.log(`  securityUpdatedAt: ${u.securityUpdatedAt?.toISOString() || 'null'}`)

  // Step 6: Now test forgot-password flow
  console.log('\n=== Step 6: forgot-password verify_email ===')
  const r6 = await fetch(`${PROD}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_email', email: EMAIL }),
  })
  const d6 = await r6.json()
  console.log(`  HTTP ${r6.status}`)
  console.log(`  body: ${JSON.stringify(d6).slice(0, 300)}`)

  // Step 7: forgot-password verify_answer with "Black"
  if (d6.securityQuestion) {
    console.log('\n=== Step 7: forgot-password verify_answer with answer "Black" ===')
    const r7 = await fetch(`${PROD}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_answer', email: EMAIL, securityAnswer: 'Black' }),
    })
    const d7 = await r7.json()
    console.log(`  HTTP ${r7.status}`)
    console.log(`  body: ${JSON.stringify(d7).slice(0, 300)}`)

    // Also try lowercase "black" to test case sensitivity
    console.log('\n=== Step 8: forgot-password verify_answer with lowercase "black" ===')
    const r8 = await fetch(`${PROD}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_answer', email: EMAIL, securityAnswer: 'black' }),
    })
    const d8 = await r8.json()
    console.log(`  HTTP ${r8.status}`)
    console.log(`  body: ${JSON.stringify(d8).slice(0, 300)}`)
  }

  // Cleanup: clear the security question we just set
  console.log('\n=== Step 9: Cleanup - clear security question ===')
  await db.user.update({
    where: { email: EMAIL },
    data: {
      securityQuestionIdx: null,
      securityAnswerHash: null,
      securityAttempts: 0,
      securityLockedUntil: null,
      securityUpdatedAt: null,
    },
  })
  console.log('  ✓ Cleared security question for next test')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
