export type SeatGeekEvent = {
  id: string;
  title: string;
  city?: string;
  country?: string;
  venue?: string;
  startsAt?: string;
  endsAt?: string;
};

export function fetchSeatGeekEvents(_query: string): Promise<SeatGeekEvent[]> {
  // Implementation will be connected to SeatGeek API in a dedicated issue.
  return Promise.resolve([]);
}
