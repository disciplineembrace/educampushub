import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY ? `SET (${process.env.FAST2SMS_API_KEY.length} chars, starts with ${process.env.FAST2SMS_API_KEY.slice(0, 8)}...)` : 'NOT SET',
    MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
  })
}
