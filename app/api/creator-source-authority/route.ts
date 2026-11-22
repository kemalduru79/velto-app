import { NextResponse } from 'next/server';
import { createServerSourceAuthorityWorkflow } from '../../../lib/research/sourceAuthorityWorkflow.server';

export async function POST(request: Request) {
  if (process.env.VELTO_SOURCE_AUTHORITY_ENABLED !== 'true') return NextResponse.json({ error: 'Source authority is disabled.' }, { status: 404 });
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  try {
    const workflow = createServerSourceAuthorityWorkflow();
    if (body.operation === 'freeze') return NextResponse.json(await workflow.freeze({ token, ownerId: body.ownerId, projectId: body.projectId, context: body.context }));
    if (body.operation === 'inspect') return NextResponse.json(await workflow.inspect({ token, ownerId: body.ownerId, projectId: body.projectId, snapshotDigest: body.snapshotDigest, claimId: body.claimId, evidenceId: body.evidenceId }));
    if (body.operation === 'issue') return NextResponse.json(await workflow.issue({ token, ownerId: body.ownerId, projectId: body.projectId, snapshotDigest: body.snapshotDigest, claimId: body.claimId, evidenceId: body.evidenceId, expiresAt: body.expiresAt, decision: body.decision }));
    return NextResponse.json({ error: 'Unsupported operation.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Source authority request rejected.' }, { status: 403 });
  }
}
