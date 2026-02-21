"use client";

import type { EventTripConversationState } from "@/lib/eventtrip/conversation-state";
import { cn } from "@/lib/utils";

export function EventTripConversationStateHint({
  state,
  onPromptSelect,
}: {
  state: EventTripConversationState;
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <div
      className="rounded-lg border border-border/70 bg-muted/30 p-2"
      data-testid="eventtrip-conversation-state"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
            state.phase === "packages-ready"
              ? "bg-emerald-100 text-emerald-800"
              : state.phase === "event-selection"
                ? "bg-amber-100 text-amber-900"
                : "bg-blue-100 text-blue-900"
          )}
        >
          {state.label}
        </span>
        <p className="text-muted-foreground text-xs">{state.hint}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {state.suggestedPrompts.slice(0, 3).map((prompt) => (
          <button
            className="rounded-full border bg-background px-2 py-1 text-left text-xs transition-colors hover:bg-accent"
            key={prompt}
            onClick={() => onPromptSelect(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
