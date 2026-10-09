export type Campus = "norte" | "sur";
export type UserRole = "estudiante" | "conductor";

export interface UserSession {
  email: string;
  role: UserRole;
  campus: Campus;
  loggedAt: string;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface TripDraft {
  origin: Coordinates;
  destination: Coordinates;
  destinationLabel: string;
  distanceKm: number;
  durationMin: number;
  fare: number;
}

export interface TripRecord extends TripDraft {
  id: string;
  campus: Campus;
  status: "solicitado" | "confirmado" | "completado";
  createdAt: string;
}

export interface DriverRequest {
  id: string;
  campus: Campus;
  pickup: string;
  destination: string;
  fare: number;
  eta: number;
  passenger: string;
  status: "pendiente" | "aceptado" | "completado";
}
