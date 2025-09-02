import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { InteractionStatus } from '@azure/msal-browser';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  profile: any = null;
  isLoggedIn = false;

  constructor(
    private authService: MsalService,
    private msalBroadcastService: MsalBroadcastService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.msalBroadcastService.inProgress$
      .pipe(
        filter((status: InteractionStatus) => status === InteractionStatus.None),
        takeUntil(this._destroying$)
      )
      .subscribe(() => {
        this.checkAndSetActiveAccount();
      });
  }

  checkAndSetActiveAccount() {
    let activeAccount = this.authService.instance.getActiveAccount();

    if (!activeAccount && this.authService.instance.getAllAccounts().length > 0) {
      let accounts = this.authService.instance.getAllAccounts();
      this.authService.instance.setActiveAccount(accounts[0]);
      activeAccount = this.authService.instance.getActiveAccount();
    }

    if (activeAccount) {
      this.isLoggedIn = true;
      this.getProfile();
    } else {
      this.isLoggedIn = false;
      this.router.navigate(['/login']);
    }
  }

  getProfile() {
    // First, acquire a token with the required scopes
    this.authService.acquireTokenSilent({
      scopes: ['User.Read'],
      account: this.authService.instance.getActiveAccount()!
    }).subscribe({
      next: (result) => {
        // Token acquired successfully, now make the API call
        const headers = {
          'Authorization': `Bearer ${result.accessToken}`
        };
        
        this.http.get('https://graph.microsoft.com/v1.0/me', { headers })
          .subscribe({
            next: (profile) => {
              this.profile = profile;
            },
            error: (error) => {
              console.error('Error fetching profile:', error);
            }
          });
      },
      error: (error) => {
        console.error('Error acquiring token:', error);
        // If silent token acquisition fails, try interactive
        this.authService.acquireTokenRedirect({
          scopes: ['User.Read'],
          account: this.authService.instance.getActiveAccount()!
        });
      }
    });
  }

  logout() {
    this.authService.logoutRedirect();
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}