import { handleWorkpilot } from "../../../../lib/server/workpilot/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleWorkpilot(request, "rehearsal");
export const POST = GET;
