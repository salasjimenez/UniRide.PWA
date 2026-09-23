import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TripRecord } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { TripService } from '../../core/trip.service';
import { TripMapComponent } from '../trip-map/trip-map.component';

type StudentSection = 'inicio' | 'viaje' | 'historial' | 'perfil';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, TripMapComponent],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentDashboardComponent {
  readonly section = signal<StudentSection>('inicio');
  readonly session = this.sessionService.session;
  readonly trips = this.tripService.trips;
  readonly campusLabel = computed(() => {
    const current = this.session();
    return current ? this.sessionService.campusLabel(current.campus) : '';
  });
  readonly confirmedTrips = computed(() => this.trips().filter((trip) => trip.status === 'confirmado').length);
  readonly totalSpent = computed(() => this.trips().reduce((total, trip) => total + trip.fare, 0));

  constructor(
    private readonly sessionService: SessionService,
    private readonly tripService: TripService,
    private readonly router: Router
  ) {}

  open(section: StudentSection): void {
    this.section.set(section);
  }

  onTripConfirmed(_trip: TripRecord): void {
    this.section.set('historial');
  }

  logout(): void {
    this.sessionService.logout();
    void this.router.navigate(['/acceso']);
  }

  initials(): string {
    const email = this.session()?.email ?? 'U';
    return email.slice(0, 1).toUpperCase();
  }
}
