import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MicrosoftAuthService, MicrosoftUser, MicrosoftUserProfile } from '../services/microsoft-auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  
  currentUser: MicrosoftUser | null = null;
  userProfile: MicrosoftUserProfile | null = null;
  isLoading = false;

  constructor(
    private microsoftAuth: MicrosoftAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Listen for authentication state
    this.microsoftAuth.isAuthenticated$
      .pipe(takeUntil(this._destroying$))
      .subscribe(isAuthenticated => {
        if (!isAuthenticated) {
          this.router.navigate(['/login']);
        }
      });

    // Listen for user changes
    this.microsoftAuth.currentUser$
      .pipe(takeUntil(this._destroying$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Listen for profile changes
    this.microsoftAuth.userProfile$
      .pipe(takeUntil(this._destroying$))
      .subscribe(profile => {
        this.userProfile = profile;
      });

    // Listen for loading state
    this.microsoftAuth.isLoading$
      .pipe(takeUntil(this._destroying$))
      .subscribe(isLoading => {
        this.isLoading = isLoading;
      });
  }

  logout(): void {
    this.microsoftAuth.signOut();
  }

  logoutPopup(): void {
    this.microsoftAuth.signOutPopup().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
      }
    });
  }

  // Example of using Graph API through the service
  async refreshProfile(): Promise<void> {
    const profile = await this.microsoftAuth.makeGraphApiCall<MicrosoftUserProfile>('/me');
    if (profile) {
      console.log('Profile refreshed:', profile);
    }
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}