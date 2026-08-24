import { deleteCurrentSession, errorResponse, sessionCookie } from '../../../lib/server';

export async function POST() {
  try {
    await deleteCurrentSession();
    return new Response(JSON.stringify({ ok:true }), { status:200, headers:{ 'content-type':'application/json', 'set-cookie':sessionCookie('',0) } });
  } catch (error) { return errorResponse(error); }
}
