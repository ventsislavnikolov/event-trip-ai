export type TicketmasterEvent = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
};

export async function fetchTicketmasterEvents(
  _query: string
): Promise<TicketmasterEvent[]> {
  // Implementation will be connected to Ticketmaster API in a dedicated issue.
  return [];
}
