export type EventTripFunnelEventName =
  | "intent_detected"
  | "follow_up_requested"
  | "event_selection_required"
  | "packages_generated"
  | "packages_fallback"
  | "outbound_click";

export function buildEventTripFunnelEvent(
  event: EventTripFunnelEventName,
  payload: Record<string, unknown>
) {
  return {
    event,
    payload,
    occurredAt: new Date().toISOString(),
  };
}

export function emitEventTripFunnelEvent(
  event: EventTripFunnelEventName,
  payload: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info("[eventtrip.funnel]", buildEventTripFunnelEvent(event, payload));
}
