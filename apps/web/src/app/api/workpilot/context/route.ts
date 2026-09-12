import { handleWorkpilot } from "../../../../lib/server/workpilot/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleWorkpilot(request, "context");
export const POST = GET;
