import { NextResponse } from 'next/server'

export async function GET() {
  // Check what env vars are available
  const allEnvKeys = Object.keys(process.env).filter(k => 
    k.includes('BREVO') || k.includes('DATABASE') || k.includes('JWT') || k.includes('API')
  )
  
  const brevoKey = process.env.BREVO_API_KEY || ''
  const dbUrl = process.env.DATABASE_URL || ''
  
  return NextResponse.json({
    brevoKeyLength: brevoKey.length,
    brevoKeyPrefix: brevoKey ? brevoKey.substring(0, 15) + '...' : 'EMPTY',
    dbUrlPrefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'EMPTY',
    envKeysFound: allEnvKeys,
    nodeEnv: process.env.NODE_ENV,
  })
}
