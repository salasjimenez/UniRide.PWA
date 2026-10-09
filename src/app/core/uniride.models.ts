export type Campus = "norte" | "sur";
export type Role = "estudiante" | "conductor";
export type Language = "es" | "en";
export type Theme = "light" | "slate";
export type RideStatus = "solicitado" | "aceptado" | "completado";
export interface GeoPoint {
  lat: number;
  lon: number;
}
export interface CampusInfo {
  id: Campus;
  name: string;
  address: string;
  district: string;
  search: string;
  accent: string;
}
export const CAMPUSES: readonly CampusInfo[] = [
  {
    id: "norte",
    name: "Campus Lima Norte",
    address: "Panamericana Norte km 30, Puente Piedra",
    district: "Puente Piedra",
    search: "Panamericana Norte km 30 Puente Piedra Lima Peru",
    accent: "N",
  },
  {
    id: "sur",
    name: "Campus Lima Sur",
    address: "Panamericana Sur km 16.3, Villa El Salvador",
    district: "Villa El Salvador",
    search: "Universidad Autónoma del Perú Villa El Salvador Lima Peru",
    accent: "S",
  },
];
export interface Session {
  name: string;
  email: string;
  role: Role;
  campus: Campus;
  since: string;
}
export interface Quote {
  pickup: string;
  campus: Campus;
  distanceKm: number;
  durationMin: number;
  fare: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  source: "route" | "approx" | "reference";
  generatedAt: string;
}
export interface Ride extends Quote {
  id: string;
  passenger: string;
  passengerEmail: string;
  driverEmail?: string;
  status: RideStatus;
  createdAt: string;
}
