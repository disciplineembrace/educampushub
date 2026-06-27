import { NextResponse } from 'next/server'

export async function GET() {
  const brevoKey = process.env.BREVO_API_KEY ? 'configured' : 'missing'
  const dbUrl = process.env.DATABASE_URL ? 'configured' : 'missing'

  return NextResponse.json({
    status: 'ok',
    service: 'EduCampusHub',
    timestamp: new Date().toISOString(),
    services: {
      email: brevoKey,
      database: dbUrl,
    },
  })
}
