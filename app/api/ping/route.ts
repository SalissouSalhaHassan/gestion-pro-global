import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth_helper';

export async function GET() {
  const session = await getServerSession();
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    sessionFound: !!session,
    userId: session?.id,
    role: session?.role
  });
}
