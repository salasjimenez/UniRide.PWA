import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DriverRequest } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { TripService } from '../../core/trip.service';

type DriverSection = 'inicio' | 'solicitudes' | 'viaje' | 'perfil';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-dashboard.component.html',
  styleUrl: './driver-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriverDashboardComponent {
  readonly section = signal<DriverSection>('inicio');
  readonly message = signal('');
  readonly session = this.sessionService.session;
  readonly available = this.sessionService.driverAvailable;
  readonly campusLabel = computed(() => {
    const current = this.session();
    return current ? this.sessionService.campusLabel(current.campus) : '';
  });
  readonly requests = computed(() => {
    const current = this.session();
    if (!current) return [];
    return this.tripService.driverRequests().filter((request) => request.campus === current.campus);
  });
  readonly pendingRequests = computed(() => this.requests().filter((request) => request.status === 'pendiente'));
  readonly completedRequests = computed(() => this.requests().filter((request) => request.status === 'completado'));
  readonly activeRequest = computed(() => this.requests().find((request) => request.status === 'aceptado') ?? null);
  readonly earnings = computed(() => this.completedRequests().reduce((total, request) => total + request.fare, 0));

  constructor(
    private readonly sessionService: SessionService,
    private readonly tripService: TripService,
    private readonly router: Router
  ) {}

  open(section: DriverSection): void {
    this.section.set(section);
    this.message.set('');
  }

  toggleAvailability(): void {
    const next = !this.available();
    this.sessionService.setDriverAvailability(next);
    this.message.set(next ? 'Ahora estás disponible para recibir solicitudes.' : 'Tu estado cambió a no disponible.');
  }

  accept(request: DriverRequest): void {
    if (!this.available()) {
      this.message.set('Activa tu disponibilidad antes de aceptar un viaje.');
      return;
    }

    if (this.activeRequest()) {
      this.message.set('Finaliza tu viaje activo antes de aceptar otra solicitud.');
      return;
    }

    this.tripService.acceptRequest(request.id);
    this.message.set(`Solicitud ${request.id} aceptada.`);
    this.section.set('viaje');
  }

  completeActive(): void {
    const active = this.activeRequest();
    if (!active) return;
    this.tripService.completeRequest(active.id);
    this.message.set(`Viaje ${active.id} completado correctamente.`);
  }

  logout(): void {
    this.sessionService.logout();
    void this.router.navigate(['/acceso']);
  }

  initials(): string {
    const email = this.session()?.email ?? 'C';
    return email.slice(0, 1).toUpperCase();
  }
}
