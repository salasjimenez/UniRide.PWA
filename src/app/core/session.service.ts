import { Injectable, signal } from "@angular/core";
import { Campus, UserRole, UserSession } from "./models";

@Injectable({ providedIn: "root" })
export class SessionService {
  private readonly storageKey = "uniride.session";
  private readonly availabilityKey = "uniride.driver.available";

  readonly session = signal<UserSession | null>(this.readSession());
  readonly driverAvailable = signal<boolean>(
    localStorage.getItem(this.availabilityKey) === "true",
  );

  login(email: string, role: UserRole, campus: Campus): void {
    const session: UserSession = {
      email,
      role,
      campus,
      loggedAt: new Date().toISOString(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.session.set(session);
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.session.set(null);
  }

  setDriverAvailability(value: boolean): void {
    localStorage.setItem(this.availabilityKey, String(value));
    this.driverAvailable.set(value);
  }

  roleLabel(role: UserRole): string {
    return role === "estudiante" ? "Estudiante" : "Conductor";
  }

  campusLabel(campus: Campus): string {
    return campus === "norte" ? "Sede Norte" : "Sede Sur";
  }

  private readSession(): UserSession | null {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as UserSession;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }
}
