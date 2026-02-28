import { headers } from "next/headers";
import { getUserFromAuthHeader } from "@/lib/authz";

export async function GET() {
  const headerList = await headers();
  const user = await getUserFromAuthHeader(headerList.get("authorization"));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  return new Response(
    JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      doctorId: user.doctorId,
    }),
    { status: 200 },
  );
}
