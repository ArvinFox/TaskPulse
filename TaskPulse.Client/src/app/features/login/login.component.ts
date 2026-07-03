import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  
  // States
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // If already logged in, redirect directly to dashboard
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit() {
    this.errorMessage.set(null);
    
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage.set('Please enter both username and password.');
      return;
    }

    this.isLoading.set(true);

    // Simulate database network delay (500ms)
    setTimeout(() => {
      const success = this.authService.login(this.username, this.password);
      
      if (success) {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage.set('Invalid credentials. Use admin / admin123.');
        this.isLoading.set(false);
      }
    }, 500);
  }
}
