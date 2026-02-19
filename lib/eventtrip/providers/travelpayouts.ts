export type TravelPayoutsFlightOption = {
  id: string;
  airline?: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
};

export type TravelPayoutsHotelOption = {
  id: string;
  name: string;
  city: string;
  pricePerNight: number;
  currency: string;
};

export async function fetchTravelPayoutsFlights(_params: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
}): Promise<TravelPayoutsFlightOption[]> {
  // Implementation will be connected to TravelPayouts API in a dedicated issue.
  return [];
}

export async function fetchTravelPayoutsHotels(_params: {
  destinationCity: string;
  checkInDate: string;
  checkOutDate: string;
}): Promise<TravelPayoutsHotelOption[]> {
  // Implementation will be connected to TravelPayouts API in a dedicated issue.
  return [];
}
