import type { EventTripSelectedEventData } from "@/lib/types";

function toLocation(event: EventTripSelectedEventData): string | undefined {
  const city = event.city?.trim();
  const country = event.country?.trim();

  if (city && country) {
    return `${city}, ${country}`;
  }

  return city || country || undefined;
}

function toDateLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

export function SelectedEventSummary({
  event,
}: {
  event: EventTripSelectedEventData;
}) {
  const location = toLocation(event);
  const startsAt = toDateLabel(event.startsAt);

  return (
    <section
      className="mb-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm"
      data-testid="eventtrip-selected-event"
    >
      <p className="font-medium">{event.name}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <span>Provider: {event.provider}</span>
        {location ? <span>Location: {location}</span> : null}
        {event.venue ? <span>Venue: {event.venue}</span> : null}
        {startsAt ? <span>Starts: {startsAt}</span> : null}
      </div>
    </section>
  );
}
