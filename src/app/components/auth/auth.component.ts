import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Campus, UserRole } from '../../core/models';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthComponent implements OnInit {
  selectedCampus: Campus | null = null;
  selectedRole: UserRole | null = null;
  email = '';
  password = '';
  message = '';
  loading = false;

  constructor(
    private readonly sessionService: SessionService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const session = this.sessionService.session();
    if (session) {
      void this.router.navigate([session.role === 'estudiante' ? '/estudiante' : '/conductor']);
    }
  }

  selectCampus(campus: Campus): void {
    this.selectedCampus = campus;
    this.message = '';
  }

  selectRole(role: UserRole): void {
    this.selectedRole = role;
    this.message = '';
  }

  login(): void {
    const email = this.email.trim().toLowerCase();

    if (!this.selectedCampus) {
      this.message = 'Selecciona una sede para continuar.';
      return;
    }

    if (!this.selectedRole) {
      this.message = 'Selecciona tu rol para continuar.';
      return;
    }

    if (!email.endsWith('@autonoma.edu.pe')) {
      this.message = 'Ingresa un correo institucional @autonoma.edu.pe.';
      return;
    }

    if (this.password.length < 8) {
      this.message = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    this.loading = true;
    this.sessionService.login(email, this.selectedRole, this.selectedCampus);
    void this.router.navigate([this.selectedRole === 'estudiante' ? '/estudiante' : '/conductor']);
  }
}
