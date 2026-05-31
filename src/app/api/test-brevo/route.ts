import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.BREVO_API_KEY || ''
  
  if (!apiKey) {
    return NextResponse.json({ error: 'BREVO_API_KEY not set' })
  }

  try {
    // Test: Send a simple email
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
        subject: 'EduCampusHub - Test OTP Email',
        htmlContent: '<div style="font-family:Arial,sans-serif;text-align:center;padding:40px"><h2 style="color:#002868">EduCampusHub</h2><p>Test OTP Email</p><p style="font-size:32px;font-weight:bold;color:#FF6600;letter-spacing:4px">123456</p><p>This is a test. If you received this, Brevo email OTP is working!</p></div>',
        textContent: 'EduCampusHub Test OTP: 123456. If you received this, Brevo email OTP is working!'
      })
    })
    const emailData = await emailRes.json()

    return NextResponse.json({
      keyPrefix: apiKey.substring(0, 15) + '...',
      emailStatus: emailRes.status,
      emailResponse: emailData,
      success: emailRes.ok
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) })
  }
}
