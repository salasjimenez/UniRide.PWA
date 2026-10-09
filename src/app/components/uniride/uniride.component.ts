import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  CAMPUSES,
  Campus,
  GeoPoint,
  Quote,
  Ride,
  Role,
} from "../../core/uniride.models";
import { translate, TranslationKey } from "../../core/uniride-i18n";
import { UniRideQuoteService } from "../../core/uniride-quote.service";
import { UniRideStore } from "../../core/uniride-store.service";

type Page = "home" | "trip" | "requests" | "history" | "profile" | "info";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

@Component({
  selector: "app-uniride",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./uniride.component.html",
  styleUrl: "./uniride.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniRideComponent implements OnInit, OnDestroy {
  readonly store: UniRideStore;
  readonly campuses = CAMPUSES;
  readonly page = signal<Page>("home");
  readonly session = computed(() => this.store.session());
  readonly myTrips = computed(() =>
    this.store.rides().filter((r) => {
      const user = this.store.session();
      return user?.role === "estudiante"
        ? r.passengerEmail === user.email
        : r.driverEmail === user?.email;
    }),
  );
  readonly pendingRequests = computed(() =>
    this.store
      .rides()
      .filter(
        (r) =>
          r.status === "solicitado" &&
          r.campus === this.store.session()?.campus,
      ),
  );
  readonly activeRide = computed(() =>
    this.store
      .rides()
      .find(
        (r) =>
          r.status === "aceptado" &&
          r.driverEmail === this.store.session()?.email,
      ),
  );
  readonly pendingTripCount = computed(
    () => this.myTrips().filter((ride) => ride.status === "solicitado").length,
  );
  readonly totalSpent = computed(() =>
    this.myTrips().reduce((sum, r) => sum + r.fare, 0),
  );
  readonly quote = signal<Quote | null>(null);
  readonly busy = signal(false);
  readonly notice = signal("");
  readonly hasGps = signal(false);
  readonly canInstall = signal(false);
  readonly visibleLegal = signal<"terms" | "privacy" | null>(null);
  readonly year = new Date().getFullYear();
  role: Role = "estudiante";
  selectedCampus: Campus = "sur";
  name = "";
  email = "";
  pickup = "";
  destination: Campus = "sur";
  acceptedTerms = false;
  private gpsPosition?: GeoPoint;
  private installEvent?: InstallEvent;
  private readonly handleInstall = (event: Event): void => {
    event.preventDefault();
    this.installEvent = event as InstallEvent;
    this.canInstall.set(true);
  };
  constructor(
    store: UniRideStore,
    private readonly quoteService: UniRideQuoteService,
  ) {
    this.store = store;
  }
  ngOnInit(): void {
    window.addEventListener("beforeinstallprompt", this.handleInstall);
    this.destination = this.session()?.campus ?? "sur";
  }
  ngOnDestroy(): void {
    window.removeEventListener("beforeinstallprompt", this.handleInstall);
  }

  t(key: TranslationKey): string {
    return translate(this.store.language(), key);
  }
  campusName(id: Campus): string {
    return this.store.language() === "es"
      ? id === "norte"
        ? "Lima Norte"
        : "Lima Sur"
      : id === "norte"
        ? "North Lima"
        : "South Lima";
  }
  campusAddress(id: Campus): string {
    return this.campuses.find((c) => c.id === id)?.address ?? "";
  }
  setPage(page: Page): void {
    this.page.set(page);
    this.notice.set("");
    this.visibleLegal.set(null);
  }
  setDestination(campus: Campus): void {
    this.destination = campus;
    this.quote.set(null);
    this.notice.set("");
  }
  onPickupChanged(value: string): void {
    this.pickup = value;
    this.gpsPosition = undefined;
    this.hasGps.set(false);
    this.quote.set(null);
  }
  login(): void {
    const email = this.email.trim();
    if (
      this.name.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !this.acceptedTerms
    ) {
      this.notice.set(this.t("errorForm"));
      return;
    }
    this.store.login(this.name, email, this.role, this.selectedCampus);
    this.destination = this.selectedCampus;
    this.page.set("home");
    this.notice.set("");
  }
  logout(): void {
    this.store.logout();
    this.quote.set(null);
    this.gpsPosition = undefined;
    this.page.set("home");
    this.notice.set("");
  }
  async install(): Promise<void> {
    if (!this.installEvent) return;
    await this.installEvent.prompt();
    await this.installEvent.userChoice;
    this.installEvent = undefined;
    this.canInstall.set(false);
  }
  locate(): void {
    this.notice.set("");
    if (!navigator.geolocation) {
      this.notice.set(this.t("errorGeo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.gpsPosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        this.hasGps.set(true);
        this.pickup =
          this.store.language() === "es"
            ? "Ubicación actual (GPS)"
            : "Current location (GPS)";
        this.quote.set(null);
      },
      () => this.notice.set(this.t("errorGeo")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }
  async calculate(): Promise<void> {
    if (this.busy()) return;
    this.notice.set("");
    this.quote.set(null);
    this.busy.set(true);
    try {
      const quote = await this.quoteService.calculate(
        this.pickup,
        this.destination,
        this.gpsPosition,
      );
      this.quote.set(quote);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      this.notice.set(
        msg === "PICKUP_REQUIRED"
          ? this.t("pickupHint")
          : msg === "LOCATION_NOT_FOUND"
            ? this.t("errorLocation")
            : this.t("errorNetwork"),
      );
    } finally {
      this.busy.set(false);
    }
  }
  confirmRide(): void {
    const quote = this.quote();
    if (!quote || !this.session() || this.session()?.role !== "estudiante")
      return;
    this.store.requestRide(quote);
    this.quote.set(null);
    this.pickup = "";
    this.gpsPosition = undefined;
    this.hasGps.set(false);
    this.page.set("history");
    this.notice.set(this.t("saved"));
  }
  acceptRide(ride: Ride): void {
    if (!this.store.acceptRide(ride.id)) return;
    this.page.set("home");
  }
  completeRide(ride: Ride): void {
    this.store.completeRide(ride.id);
  }
  statusLabel(status: Ride["status"]): string {
    return this.store.language() === "es"
      ? {
          solicitado: "Solicitado",
          aceptado: "Aceptado",
          completado: "Completado",
        }[status]
      : {
          solicitado: "Requested",
          aceptado: "Accepted",
          completado: "Completed",
        }[status];
  }
  quoteSource(source: Quote["source"]): string {
    return source === "route"
      ? this.t("methodRoute")
      : source === "reference"
        ? this.t("methodReference")
        : this.t("methodApprox");
  }
  initials(): string {
    return (
      this.session()
        ?.name.split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase() || "UR"
    );
  }
  protected readonly Object = Object;
}
