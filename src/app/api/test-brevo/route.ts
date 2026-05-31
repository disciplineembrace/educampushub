import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.BREVO_API_KEY || ''
  
  if (!apiKey) {
    return NextResponse.json({ error: 'BREVO_API_KEY not set' })
  }

  try {
    // Test 1: Account info
    const accountRes = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' }
    })
    const accountData = await accountRes.json()

    // Test 2: Try sending a test email
    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 
        'api-key': apiKey, 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'EduCampusHub', email: 'noreply@educampushub.in' },
        to: [{ email: 'sagathiyapradip2002@gmail.com', name: 'Pradip' }],
        subject: 'EduCampusHub Test Email',
        htmlContent: '<p>This is a test email from EduCampusHub.</p>',
        textContent: 'This is a test email from EduCampusHub.'
      })
    })
    const emailData = await emailRes.json()

    return NextResponse.json({
      keyPrefix: apiKey.substring(0, 10) + '...',
      account: { status: accountRes.status, data: accountData },
      email: { status: emailRes.status, data: emailData }
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) })
  }
}
