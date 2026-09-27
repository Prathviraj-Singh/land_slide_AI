import { NextRequest, NextResponse } from 'next/server';

// TODO: Route handler calling server/email/sendAlertEmail.ts (thin route, no business logic)
export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'TODO: Trigger email alert dispatch' });
}
