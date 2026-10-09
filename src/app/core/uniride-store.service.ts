import { Injectable, signal } from "@angular/core";
import {
  Campus,
  Language,
  Quote,
  Ride,
  Role,
  Session,
  Theme,
} from "./uniride.models";

const PREFIX = "uniride.v3.";
function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage disabled */
  }
}

@Injectable({ providedIn: "root" })
export class UniRideStore {
  readonly session = signal<Session | null>(
    load<Session | null>("session", null),
  );
  readonly language = signal<Language>(load<Language>("language", "es"));
  readonly theme = signal<Theme>(load<Theme>("theme", "light"));
  readonly rides = signal<Ride[]>(load<Ride[]>("rides", []));
  readonly available = signal<boolean>(load<boolean>("available", false));

  login(name: string, email: string, role: Role, campus: Campus): void {
    const session: Session = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      campus,
      since: new Date().toISOString(),
    };
    this.session.set(session);
    save("session", session);
  }
  logout(): void {
    this.session.set(null);
    save("session", null);
    this.available.set(false);
    save("available", false);
  }
  setLanguage(language: Language): void {
    this.language.set(language);
    save("language", language);
  }
  setTheme(theme: Theme): void {
    this.theme.set(theme);
    save("theme", theme);
  }
  setAvailable(value: boolean): void {
    this.available.set(value);
    save("available", value);
  }

  requestRide(quote: Quote): Ride {
    const session = this.session();
    if (!session || session.role !== "estudiante")
      throw new Error("Student session required");
    const ride: Ride = {
      ...quote,
      id: `UR-${Date.now().toString(36).toUpperCase()}`,
      passenger: session.name,
      passengerEmail: session.email,
      status: "solicitado",
      createdAt: new Date().toISOString(),
    };
    this.persist([ride, ...this.rides()]);
    return ride;
  }
  acceptRide(id: string): boolean {
    const session = this.session();
    const ride = this.rides().find((r) => r.id === id);
    if (
      !session ||
      session.role !== "conductor" ||
      !this.available() ||
      !ride ||
      ride.status !== "solicitado" ||
      ride.campus !== session.campus
    )
      return false;
    if (
      this.rides().some(
        (r) => r.status === "aceptado" && r.driverEmail === session.email,
      )
    )
      return false;
    this.persist(
      this.rides().map((r) =>
        r.id === id
          ? { ...r, status: "aceptado", driverEmail: session.email }
          : r,
      ),
    );
    return true;
  }
  completeRide(id: string): boolean {
    const session = this.session();
    const ride = this.rides().find((r) => r.id === id);
    if (
      !session ||
      session.role !== "conductor" ||
      !ride ||
      ride.status !== "aceptado" ||
      ride.driverEmail !== session.email
    )
      return false;
    this.persist(
      this.rides().map((r) =>
        r.id === id ? { ...r, status: "completado" } : r,
      ),
    );
    return true;
  }
  private persist(rides: Ride[]): void {
    this.rides.set(rides);
    save("rides", rides);
  }
}
