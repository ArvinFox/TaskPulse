import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'taskpulse_logged_in';

  constructor(private router: Router) {}

  login(username: string, password: string): boolean {
    // Simple mock authentication check
    if (username.trim() === 'admin' && password === 'admin123') {
      localStorage.setItem(this.STORAGE_KEY, 'true');
      localStorage.setItem('taskpulse_user', username);
      return true;
    }
    return false;
  }

  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('taskpulse_user');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  getUser(): string | null {
    return localStorage.getItem('taskpulse_user');
  }
}
