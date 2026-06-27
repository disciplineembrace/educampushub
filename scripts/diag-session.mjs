// Diagnose: login as a real user, verify session cookie is set, then call /api/auth/security-question
const PROD = 'https://educampushub.vercel.app'
const EMAIL = 'sagathiyasoya2009@gmail.com' // user account
const PASSWORD = 'pradip1137' // guess — we will see what the server says

async function main() {
  // Try login
  console.log('=== Step 1: Login attempt ===')
  const r = await fetch(`${PROD}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email: EMAIL, password: PASSWORD }),
  })
  console.log(`  HTTP ${r.status}`)
  const setCookie = r.headers.get('set-cookie')
  console.log(`  set-cookie: ${setCookie ? setCookie.slice(0, 100) + '...' : '(none)'}`)
  const data = await r.json()
  console.log(`  body: ${JSON.stringify(data).slice(0, 200)}`)

  if (!r.ok) {
    console.log('\n  → Login failed — this is the root cause: user cannot log in to begin with.')
    console.log('  → Without a valid session, /api/auth/security-question returns 401.')
    return
  }

  // Extract session_token from set-cookie
  const cookieMatch = (setCookie || '').match(/session_token=([^;]+)/)
  if (!cookieMatch) {
    console.log('\n  → No session_token cookie returned by login API.')
    return
  }
  const token = cookieMatch[1]

  // Now call /api/auth/security-question with the cookie
  console.log('\n=== Step 2: GET /api/auth/security-question with session cookie ===')
  const r2 = await fetch(`${PROD}/api/auth/security-question`, {
    headers: { Cookie: `session_token=${token}` },
  })
  console.log(`  HTTP ${r2.status}`)
  const d2 = await r2.json()
  console.log(`  body: ${JSON.stringify(d2).slice(0, 300)}`)

  console.log('\n=== Step 3: POST setup with question 6 (favorite color) + answer "Black" ===')
  const r3 = await fetch(`${PROD}/api/auth/security-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `session_token=${token}` },
    body: JSON.stringify({ action: 'setup', securityQuestionIdx: 6, securityAnswer: 'Black' }),
  })
  console.log(`  HTTP ${r3.status}`)
  const d3 = await r3.json()
  console.log(`  body: ${JSON.stringify(d3).slice(0, 300)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
