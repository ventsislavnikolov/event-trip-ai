"use client";

export type EventCandidate = {
  id: string;
  name: string;
  location?: string;
  startsAt?: string;
};

type DisambiguationPickerProps = {
  candidates: EventCandidate[];
  onSelect: (candidate: EventCandidate) => void;
};

export function DisambiguationPicker({
  candidates,
  onSelect,
}: DisambiguationPickerProps) {
  return (
    <div
      className="rounded-xl border bg-card p-4"
      data-testid="eventtrip-disambiguation-picker"
    >
      <p className="mb-3 text-sm font-medium">
        I found multiple matches. Choose the event you meant:
      </p>
      <ul className="space-y-2">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onSelect(candidate)}
              type="button"
            >
              <span className="font-medium">{candidate.name}</span>
              <span className="text-xs text-muted-foreground">
                {[candidate.location, candidate.startsAt]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
