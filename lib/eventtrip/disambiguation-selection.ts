import type { CustomUIDataTypes } from "@/lib/types";

type EventTripCandidate = CustomUIDataTypes["eventtripCandidates"][number];

export function buildEventCandidateSelectionPrompt(
  candidate: EventTripCandidate,
  context?: {
    originCity?: string;
    travelers?: number;
    maxBudgetPerPerson?: number | null;
  }
): string {
  const segments = [
    `I choose this event: ${candidate.name}.`,
    `Candidate ID: ${candidate.id}.`,
  ];

  if (candidate.location) {
    segments.push(`Location: ${candidate.location}.`);
  }

  if (candidate.startsAt) {
    segments.push(`Start: ${candidate.startsAt}.`);
  }

  if (context?.originCity) {
    segments.push(`From ${context.originCity}.`);
  }

  if (context?.travelers && context.travelers > 0) {
    segments.push(`Plan for ${context.travelers} travelers.`);
  }

  if (context?.maxBudgetPerPerson && context.maxBudgetPerPerson > 0) {
    segments.push(`My max budget ${context.maxBudgetPerPerson} per person.`);
  }

  segments.push("Please continue planning the trip for this exact event.");

  return segments.join(" ");
}
