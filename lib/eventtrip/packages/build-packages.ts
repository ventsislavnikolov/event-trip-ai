import {
  type PackageOptionInput,
  type RankedPackageOption,
  type RankedPackageResult,
  rankPackageOptions,
} from "./ranking";
import { buildEventTripOutboundLinks } from "../outbound-links";

type BuildPackagesInput = {
  options: PackageOptionInput[];
  maxBudgetPerPerson?: number;
};

export function buildPackages({
  options,
  maxBudgetPerPerson,
}: BuildPackagesInput): RankedPackageResult {
  return rankPackageOptions(options, { maxBudgetPerPerson });
}

export function buildFallbackPackageOptions({
  travelers,
}: {
  travelers: number;
}): PackageOptionInput[] {
  const safeTravelers = Math.max(1, travelers);

  const perPersonProfiles = [
    {
      id: "budget-fallback",
      ticketPrice: 120,
      flightPrice: 180,
      hotelPrice: 200,
      qualityScore: 55,
    },
    {
      id: "value-fallback",
      ticketPrice: 160,
      flightPrice: 220,
      hotelPrice: 240,
      qualityScore: 82,
    },
    {
      id: "premium-fallback",
      ticketPrice: 260,
      flightPrice: 280,
      hotelPrice: 360,
      qualityScore: 96,
    },
  ];

  return perPersonProfiles.map((profile) => ({
    id: `${profile.id}-${safeTravelers}`,
    ticketPrice: Math.round((profile.ticketPrice * safeTravelers * 100) / 100),
    flightPrice: Math.round((profile.flightPrice * safeTravelers * 100) / 100),
    hotelPrice: Math.round((profile.hotelPrice * safeTravelers * 100) / 100),
    qualityScore: profile.qualityScore,
    currency: "EUR",
  }));
}

export function toPackageCards(tiers: RankedPackageOption[]): {
  id: string;
  tier: RankedPackageOption["tier"];
  currency: string;
  ticketPrice: number;
  flightPrice: number;
  hotelPrice: number;
  totalPrice: number;
  withinBudget: boolean;
  overBudgetAmount: number;
  bookingLinks: {
    ticket: string;
    flight: string;
    hotel: string;
  };
}[] {
  return tiers.map((tier) => ({
    id: tier.id,
    tier: tier.tier,
    currency: tier.currency,
    ticketPrice: tier.ticketPrice,
    flightPrice: tier.flightPrice,
    hotelPrice: tier.hotelPrice,
    totalPrice: tier.totalPrice,
    withinBudget: tier.withinBudget,
    overBudgetAmount: tier.overBudgetAmount,
    bookingLinks: buildEventTripOutboundLinks({
      packageId: tier.id,
      tier: tier.tier,
    }),
  }));
}
