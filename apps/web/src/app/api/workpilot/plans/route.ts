import { handleWorkpilot } from "../../../../lib/server/workpilot/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleWorkpilot(request, "plans");
export const POST = GET;
