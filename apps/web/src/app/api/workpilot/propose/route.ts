import { handleWorkpilot } from "../../../../lib/server/workpilot/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => handleWorkpilot(request, "propose");
