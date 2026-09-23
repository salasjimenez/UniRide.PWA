import { Routes } from '@angular/router';
import { roleGuard } from './core/auth.guard';
import { AuthComponent } from './components/auth/auth.component';
import { StudentDashboardComponent } from './components/student-dashboard/student-dashboard.component';
import { DriverDashboardComponent } from './components/driver-dashboard/driver-dashboard.component';

export const routes: Routes = [
  { path: 'acceso', component: AuthComponent },
  {
    path: 'estudiante',
    component: StudentDashboardComponent,
    canActivate: [roleGuard],
    data: { role: 'estudiante' }
  },
  {
    path: 'conductor',
    component: DriverDashboardComponent,
    canActivate: [roleGuard],
    data: { role: 'conductor' }
  },
  { path: '', pathMatch: 'full', redirectTo: 'acceso' },
  { path: '**', redirectTo: 'acceso' }
];
