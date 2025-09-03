import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthManagerService, UnifiedUser, AuthProvider } from '../services/auth-manager.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  
  currentUser: UnifiedUser | null = null;
  currentProvider: AuthProvider = null;
  isLoading = false;

  constructor(
    private authManager: AuthManagerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Listen for authentication state
    this.authManager.isAuthenticated$
      .pipe(takeUntil(this._destroying$))
      .subscribe(isAuthenticated => {
        if (!isAuthenticated) {
          this.router.navigate(['/login']);
        }
      });

    // Listen for user changes
    this.authManager.currentUser$
      .pipe(takeUntil(this._destroying$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Listen for provider changes
    this.authManager.currentProvider$
      .pipe(takeUntil(this._destroying$))
      .subscribe(provider => {
        this.currentProvider = provider;
      });
  }

  async logout(): Promise<void> {
    this.isLoading = true;
    try {
      await this.authManager.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.isLoading = false;
    }
  }

  getProviderDisplayName(): string {
    switch (this.currentProvider) {
      case 'microsoft':
        return 'Microsoft';
      case 'google':
        return 'Google';
      default:
        return 'Unknown';
    }
  }

  getProviderIcon(): string {
    switch (this.currentProvider) {
      case 'microsoft':
        return '🔷';
      case 'google':
        return '🔴';
      default:
        return '❓';
    }
  }

  getProviderColor(): string {
    switch (this.currentProvider) {
      case 'microsoft':
        return '#0078d4';
      case 'google':
        return '#4285f4';
      default:
        return '#6c757d';
    }
  }

  // Provider-specific methods for accessing additional data
  getMicrosoftProfile(): any {
    if (this.currentProvider === 'microsoft' && this.currentUser) {
      return this.currentUser.rawData;
    }
    return null;
  }

  getGoogleProfile(): any {
    if (this.currentProvider === 'google' && this.currentUser) {
      return this.currentUser.rawData;
    }
    return null;
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}