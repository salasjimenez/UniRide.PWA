import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Campus, Coordinates, TripDraft, TripRecord } from '../../core/models';
import { TripService } from '../../core/trip.service';

declare const L: any;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface OsrmResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: unknown;
  }>;
}

@Component({
  selector: 'app-trip-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trip-map.component.html',
  styleUrl: './trip-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripMapComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) campus!: Campus;
  @Output() tripConfirmed = new EventEmitter<TripRecord>();
  @ViewChild('mapCanvas', { static: true }) mapCanvas!: ElementRef<HTMLDivElement>;

  destinationText = '';
  originText = 'Ubicación pendiente';
  statusMessage = '';
  busy = false;
  draft: TripDraft | null = null;

  private map: any;
  private origin: Coordinates | null = null;
  private destination: Coordinates | null = null;
  private originMarker: any;
  private destinationMarker: any;
  private routeLine: any;

  constructor(
    private readonly http: HttpClient,
    private readonly tripService: TripService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  locateMe(): void {
    this.statusMessage = '';
    this.busy = true;

    if (!navigator.geolocation) {
      this.statusMessage = 'Este navegador no permite geolocalización.';
      this.busy = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
        this.busy = false;
        this.cdr.markForCheck();
      },
      () => {
        this.statusMessage = 'No se pudo obtener tu ubicación. Revisa los permisos de GPS.';
        this.busy = false;
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  calculateRoute(): void {
    const query = this.destinationText.trim();
    this.statusMessage = '';
    this.draft = null;

    if (!query && !this.destination) {
      this.statusMessage = 'Escribe un destino o selecciónalo directamente en el mapa.';
      return;
    }

    this.busy = true;
    this.ensureOrigin()
      .then(() => this.resolveDestination(query))
      .then(() => this.requestRoute())
      .catch((error: Error) => {
        this.statusMessage = error.message || 'No se pudo calcular la ruta.';
      })
      .finally(() => {
        this.busy = false;
        this.cdr.markForCheck();
      });
  }

  confirmTrip(): void {
    if (!this.draft) return;
    const trip = this.tripService.confirmTrip(this.draft, this.campus);
    this.statusMessage = `Viaje ${trip.id} confirmado correctamente.`;
    this.tripConfirmed.emit(trip);
    this.cdr.markForCheck();
  }

  resetTrip(): void {
    this.destinationText = '';
    this.destination = null;
    this.draft = null;
    this.statusMessage = '';
    if (this.destinationMarker) {
      this.destinationMarker.remove();
      this.destinationMarker = null;
    }
    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = null;
    }
    if (this.origin && this.map) this.map.setView([this.origin.lat, this.origin.lon], 15);
  }

  private initMap(): void {
    if (typeof L === 'undefined') {
      this.statusMessage = 'El mapa no pudo cargarse. Revisa la conexión a internet.';
      this.cdr.markForCheck();
      return;
    }

    this.map = L.map(this.mapCanvas.nativeElement, { zoomControl: false }).setView([-12.0464, -77.0428], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    this.map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
      this.setDestination({ lat: event.latlng.lat, lon: event.latlng.lng }, 'Destino seleccionado en el mapa');
      this.cdr.markForCheck();
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private ensureOrigin(): Promise<void> {
    if (this.origin) return Promise.resolve();

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Activa la geolocalización para calcular tu ruta.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
          resolve();
        },
        () => reject(new Error('No se pudo obtener tu ubicación. Revisa los permisos de GPS.')),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  private resolveDestination(query: string): Promise<void> {
    if (!query && this.destination) return Promise.resolve();
    if (this.destination && query === 'Destino seleccionado en el mapa') return Promise.resolve();

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    return new Promise((resolve, reject) => {
      this.http.get<NominatimResult[]>(url).subscribe({
        next: (results) => {
          const result = results[0];
          if (!result) {
            reject(new Error('No se encontró ese destino. Prueba con una dirección más específica.'));
            return;
          }
          this.setDestination({ lat: Number(result.lat), lon: Number(result.lon) }, result.display_name);
          resolve();
        },
        error: () => reject(new Error('No se pudo consultar el destino en este momento.'))
      });
    });
  }

  private requestRoute(): Promise<void> {
    if (!this.origin || !this.destination) {
      return Promise.reject(new Error('Faltan los datos de origen o destino.'));
    }

    const origin = this.origin;
    const destination = this.destination;
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`;

    return new Promise((resolve) => {
      this.http.get<OsrmResponse>(url).subscribe({
        next: (response) => {
          if (response.code === 'Ok' && response.routes[0]) {
            const route = response.routes[0];
            this.drawRoute(route.geometry);
            this.draft = {
              origin,
              destination,
              destinationLabel: this.destinationText,
              distanceKm: route.distance / 1000,
              durationMin: route.duration / 60,
              fare: this.calculateFare(route.distance / 1000)
            };
            resolve();
            return;
          }
          this.useFallbackRoute(origin, destination);
          resolve();
        },
        error: () => {
          this.useFallbackRoute(origin, destination);
          resolve();
        }
      });
    });
  }

  private setOrigin(coordinates: Coordinates): void {
    this.origin = coordinates;
    this.originText = `${coordinates.lat.toFixed(5)}, ${coordinates.lon.toFixed(5)}`;
    if (!this.map) return;

    if (this.originMarker) this.originMarker.remove();
    this.originMarker = L.marker([coordinates.lat, coordinates.lon]).addTo(this.map).bindPopup('Tu ubicación');
    this.map.setView([coordinates.lat, coordinates.lon], 15);
  }

  private setDestination(coordinates: Coordinates, label: string): void {
    this.destination = coordinates;
    this.destinationText = label;
    this.draft = null;
    if (!this.map) return;

    if (this.destinationMarker) this.destinationMarker.remove();
    this.destinationMarker = L.marker([coordinates.lat, coordinates.lon]).addTo(this.map).bindPopup('Destino');
  }

  private drawRoute(geometry: unknown): void {
    if (!this.map) return;
    if (this.routeLine) this.routeLine.remove();
    this.routeLine = L.geoJSON(geometry).addTo(this.map);
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [24, 24] });
  }

  private useFallbackRoute(origin: Coordinates, destination: Coordinates): void {
    const distanceKm = this.haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
    this.draft = {
      origin,
      destination,
      destinationLabel: this.destinationText,
      distanceKm,
      durationMin: (distanceKm / 18) * 60,
      fare: this.calculateFare(distanceKm)
    };
    this.statusMessage = 'Ruta estimada sin trazo detallado.';
  }

  private calculateFare(distanceKm: number): number {
    return 4.5 + (1.6 * distanceKm) + 0.9;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const radius = 6371;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
}
