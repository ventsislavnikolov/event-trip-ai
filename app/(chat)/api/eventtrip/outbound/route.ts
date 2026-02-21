import { z } from "zod";
import { createApiSuccessResponse } from "@/lib/api/contracts";
import { ChatSDKError } from "@/lib/errors";

const outboundClickSchema = z.object({
  packageId: z.string().min(1),
  tier: z.enum(["Budget", "Best Value", "Premium"]),
  linkType: z.enum(["ticket", "flight", "hotel"]),
  destinationUrl: z.string().url(),
  totalPrice: z.number().nonnegative(),
  currency: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = outboundClickSchema.parse(json);

    if (process.env.NODE_ENV !== "test") {
      console.info("[eventtrip.outbound-click]", payload);
    }

    return createApiSuccessResponse({ tracked: true });
  } catch (_error) {
    return new ChatSDKError("bad_request:api").toResponse();
  }
}
