import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MicrosoftAuthService } from '../services/microsoft-auth.service';

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

  constructor(
    private microsoftAuth: MicrosoftAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if already authenticated
    if (this.microsoftAuth.isUserAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }

    // Listen for authentication state changes
    this.microsoftAuth.isAuthenticated$
      .pipe(takeUntil(this._destroying$))
      .subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.router.navigate(['/home']);
        }
      });

    // Listen for loading state changes
    this.microsoftAuth.isLoading$
      .pipe(takeUntil(this._destroying$))
      .subscribe(isLoading => {
        this.isLoading = isLoading;
      });
  }

  signInWithMicrosoft(): void {
    this.microsoftAuth.signIn();
  }

  signInWithMicrosoftPopup(): void {
    this.microsoftAuth.signInPopup().subscribe({
      next: () => {
        console.log('Login successful');
      },
      error: (error) => {
        console.error('Login failed:', error);
      }
    });
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}