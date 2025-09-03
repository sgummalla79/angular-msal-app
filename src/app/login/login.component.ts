import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthManagerService } from '../services/auth-manager.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  
  isLoading = false;
  loadingProvider: string | null = null;

  constructor(
    private authManager: AuthManagerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if already authenticated
    if (this.authManager.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }

    // Listen for authentication state changes
    this.authManager.isAuthenticated$
      .pipe(takeUntil(this._destroying$))
      .subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.isLoading = false;
          this.loadingProvider = null;
          this.router.navigate(['/home']);
        }
      });
  }

  signInWithMicrosoft(): void {
    this.setLoading('microsoft');
    this.authManager.signInWithMicrosoft();
  }

  signInWithMicrosoftPopup(): void {
    this.setLoading('microsoft');
    this.authManager.signInWithMicrosoftPopup().subscribe({
      next: () => {
        console.log('Microsoft popup login successful');
      },
      error: (error) => {
        console.error('Microsoft popup login failed:', error);
        this.clearLoading();
      }
    });
  }

  signInWithGoogle(): void {
    this.setLoading('google');
    this.authManager.signInWithGoogle();
  }

  private setLoading(provider: string): void {
    this.isLoading = true;
    this.loadingProvider = provider;
  }

  private clearLoading(): void {
    this.isLoading = false;
    this.loadingProvider = null;
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}