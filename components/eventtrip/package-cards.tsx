import { cn } from "@/lib/utils";

export type EventTripPackageTier = "Budget" | "Best Value" | "Premium";

export type EventTripPackageCard = {
  id: string;
  tier: EventTripPackageTier;
  currency: string;
  ticketPrice: number;
  flightPrice: number;
  hotelPrice: number;
  totalPrice: number;
  withinBudget: boolean;
  overBudgetAmount: number;
  bookingLinks?: {
    ticket?: string;
    flight?: string;
    hotel?: string;
  };
};

type PackageCardsProps = {
  packages: EventTripPackageCard[];
};

function formatPrice(amount: number, currency: string): string {
  return `${Math.round(amount * 100) / 100} ${currency}`;
}

export function PackageCards({ packages }: PackageCardsProps) {
  return (
    <div
      className="grid gap-4 md:grid-cols-3"
      data-testid="eventtrip-package-cards"
    >
      {packages.map((tripPackage) => (
        <article
          className="rounded-xl border bg-card p-4 shadow-sm"
          data-testid={`package-card-${tripPackage.tier.toLowerCase().replace(" ", "-")}`}
          key={tripPackage.id}
        >
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">{tripPackage.tier}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-xs font-medium",
                tripPackage.withinBudget
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              )}
            >
              {tripPackage.withinBudget
                ? "Within budget"
                : `Over by ${formatPrice(
                    tripPackage.overBudgetAmount,
                    tripPackage.currency
                  )}`}
            </span>
          </header>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt>Ticket</dt>
              <dd>{formatPrice(tripPackage.ticketPrice, tripPackage.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Flight</dt>
              <dd>{formatPrice(tripPackage.flightPrice, tripPackage.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Hotel</dt>
              <dd>{formatPrice(tripPackage.hotelPrice, tripPackage.currency)}</dd>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(tripPackage.totalPrice, tripPackage.currency)}</dd>
            </div>
          </dl>

          <footer className="mt-4 flex flex-wrap gap-2 text-xs">
            {tripPackage.bookingLinks?.ticket ? (
              <a
                className="rounded-md border px-2 py-1 hover:bg-muted"
                href={tripPackage.bookingLinks.ticket}
                rel="noreferrer noopener"
                target="_blank"
              >
                Ticket
              </a>
            ) : null}
            {tripPackage.bookingLinks?.flight ? (
              <a
                className="rounded-md border px-2 py-1 hover:bg-muted"
                href={tripPackage.bookingLinks.flight}
                rel="noreferrer noopener"
                target="_blank"
              >
                Flight
              </a>
            ) : null}
            {tripPackage.bookingLinks?.hotel ? (
              <a
                className="rounded-md border px-2 py-1 hover:bg-muted"
                href={tripPackage.bookingLinks.hotel}
                rel="noreferrer noopener"
                target="_blank"
              >
                Hotel
              </a>
            ) : null}
          </footer>
        </article>
      ))}
    </div>
  );
}
