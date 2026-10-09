import { Injectable, signal } from "@angular/core";
import { Campus, DriverRequest, TripDraft, TripRecord } from "./models";

@Injectable({ providedIn: "root" })
export class TripService {
  private readonly tripsKey = "uniride.trips";
  private readonly requestsKey = "uniride.driver.requests";

  readonly trips = signal<TripRecord[]>(this.readTrips());
  readonly driverRequests = signal<DriverRequest[]>(this.readDriverRequests());

  confirmTrip(draft: TripDraft, campus: Campus): TripRecord {
    const record: TripRecord = {
      ...draft,
      id: `UR-${Date.now().toString().slice(-6)}`,
      campus,
      status: "confirmado",
      createdAt: new Date().toISOString(),
    };

    const next = [record, ...this.trips()];
    this.trips.set(next);
    localStorage.setItem(this.tripsKey, JSON.stringify(next));
    return record;
  }

  acceptRequest(id: string): void {
    this.updateRequest(id, "aceptado");
  }

  completeRequest(id: string): void {
    this.updateRequest(id, "completado");
  }

  private updateRequest(id: string, status: DriverRequest["status"]): void {
    const next = this.driverRequests().map((request) => ({
      ...request,
      status: request.id === id ? status : request.status,
    }));
    this.driverRequests.set(next);
    localStorage.setItem(this.requestsKey, JSON.stringify(next));
  }

  private readTrips(): TripRecord[] {
    const stored = localStorage.getItem(this.tripsKey);
    if (!stored) return [];

    try {
      return JSON.parse(stored) as TripRecord[];
    } catch {
      return [];
    }
  }

  private readDriverRequests(): DriverRequest[] {
    const stored = localStorage.getItem(this.requestsKey);
    if (stored) {
      try {
        return JSON.parse(stored) as DriverRequest[];
      } catch {
        localStorage.removeItem(this.requestsKey);
      }
    }

    return [
      {
        id: "UR-1042",
        campus: "norte",
        pickup: "Puerta principal",
        destination: "Zona universitaria",
        fare: 10.8,
        eta: 4,
        passenger: "Andrea M.",
        status: "pendiente",
      },
      {
        id: "UR-1048",
        campus: "sur",
        pickup: "Punto de encuentro A",
        destination: "Paradero principal",
        fare: 8.5,
        eta: 7,
        passenger: "Luis R.",
        status: "pendiente",
      },
      {
        id: "UR-1051",
        campus: "sur",
        pickup: "Punto de encuentro B",
        destination: "Zona residencial",
        fare: 12.2,
        eta: 9,
        passenger: "Camila P.",
        status: "pendiente",
      },
    ];
  }
}
