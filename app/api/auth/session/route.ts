import { errorResponse, requireAppUser } from '../../../lib/server';

export async function GET() {
  try {
    const user = await requireAppUser({ allowPasswordChange:true });
    return Response.json({ user });
  } catch (error) { return errorResponse(error); }
}
