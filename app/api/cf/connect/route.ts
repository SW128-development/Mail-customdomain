import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body?.token as string | undefined

    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })
    }

    // Create a response with an httpOnly cookie (session-lifetime)
    const res = NextResponse.json({ success: true })
    res.cookies.set('cf_api_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
    return res
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to set token' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const res = NextResponse.json({ success: true })
    res.cookies.set('cf_api_token', '', { httpOnly: true, path: '/', maxAge: 0 })
    return res
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to clear token' }, { status: 500 })
  }
} 