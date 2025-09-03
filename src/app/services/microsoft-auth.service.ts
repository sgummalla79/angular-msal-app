import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { EventMessage, EventType, InteractionStatus, AccountInfo } from '@azure/msal-browser';

export interface MicrosoftUser {
  id: string;
  email: string;
  name: string;
  username: string;
  tenantId?: string;
  homeAccountId: string;
  localAccountId: string;
  idTokenClaims?: any;
}

export interface MicrosoftUserProfile {
  id?: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  officeLocation?: string;
  businessPhones?: string[];
  mobilePhone?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MicrosoftAuthService implements OnDestroy {
  private readonly _destroying$ = new Subject<void>();
  
  // User state
  private currentUserSubject = new BehaviorSubject<MicrosoftUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Authentication state
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  // Loading state
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();
  
  // Profile state
  private userProfileSubject = new BehaviorSubject<MicrosoftUserProfile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

  constructor(
    private msalService: MsalService,
    private msalBroadcastService: MsalBroadcastService
  ) {
    this.initializeService();
  }

  private initializeService(): void {
    // Handle MSAL redirect responses
    this.msalService.handleRedirectObservable()
      .pipe(takeUntil(this._destroying$))
      .subscribe({
        next: (result) => {
          if (result) {
            console.log('Microsoft: Redirect handled successfully');
            this.handleAuthenticationResult();
          }
        },
        error: (error) => {
          console.error('Microsoft: Redirect error:', error);
          this.isLoadingSubject.next(false);
        }
      });

    // Listen for MSAL events
    this.msalBroadcastService.msalSubject$
      .pipe(
        filter((msg: EventMessage) => 
          msg.eventType === EventType.LOGIN_SUCCESS ||
          msg.eventType === EventType.ACQUIRE_TOKEN_SUCCESS
        ),
        takeUntil(this._destroying$)
      )
      .subscribe((result: EventMessage) => {
        console.log('Microsoft: Success event:', result.eventType);
        this.handleAuthenticationResult();
      });

    // Listen for interaction status changes
    this.msalBroadcastService.inProgress$
      .pipe(
        filter((status: InteractionStatus) => status === InteractionStatus.None),
        takeUntil(this._destroying$)
      )
      .subscribe(() => {
        this.handleAuthenticationResult();
      });

    // Initial authentication check
    this.checkExistingAuthentication();
  }

  private async handleAuthenticationResult(): Promise<void> {
    try {
      const accounts = this.msalService.instance.getAllAccounts();
      
      if (accounts.length > 0) {
        // Set active account if not already set
        if (!this.msalService.instance.getActiveAccount()) {
          this.msalService.instance.setActiveAccount(accounts[0]);
        }

        const activeAccount = this.msalService.instance.getActiveAccount();
        if (activeAccount) {
          const user = this.mapAccountToUser(activeAccount);
          this.currentUserSubject.next(user);
          this.isAuthenticatedSubject.next(true);
          
          // Fetch additional profile information
          await this.fetchUserProfile();
        }
      } else {
        this.clearUserState();
      }
    } catch (error) {
      console.error('Microsoft: Error handling authentication result:', error);
      this.clearUserState();
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  private mapAccountToUser(account: AccountInfo): MicrosoftUser {
    return {
      id: account.localAccountId || account.homeAccountId || 'unknown',
      email: account.username,
      name: this.getDisplayName(account),
      username: account.username,
      tenantId: account.tenantId,
      homeAccountId: account.homeAccountId,
      localAccountId: account.localAccountId || '',
      idTokenClaims: (account as any).idTokenClaims
    };
  }

  private getDisplayName(account: AccountInfo): string {
    // Try account name first
    if (account.name) {
      return account.name;
    }

    // Try to parse from idTokenClaims
    const claims = (account as any).idTokenClaims;
    if (claims?.name) return claims.name;
    if (claims?.given_name && claims?.family_name) {
      return `${claims.given_name} ${claims.family_name}`;
    }
    if (claims?.given_name) return claims.given_name;

    // Parse from email
    if (account.username?.includes('@')) {
      const namePart = account.username.split('@')[0];
      return namePart.replace(/[._-]/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
    }

    return account.username || 'Microsoft User';
  }

  private async fetchUserProfile(): Promise<void> {
    try {
      const activeAccount = this.msalService.instance.getActiveAccount();
      if (!activeAccount) return;

      const tokenResponse = await this.msalService.acquireTokenSilent({
        scopes: ['User.Read'],
        account: activeAccount
      }).toPromise();

      if (tokenResponse?.accessToken) {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            'Authorization': `Bearer ${tokenResponse.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const profile: MicrosoftUserProfile = await response.json();
          this.userProfileSubject.next(profile);
          console.log('Microsoft: Profile fetched successfully');
        }
      }
    } catch (error) {
      console.log('Microsoft: Could not fetch profile info:', error);
      // Don't throw error, profile is optional
    }
  }

  private clearUserState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.userProfileSubject.next(null);
    this.isLoadingSubject.next(false);
  }

  private checkExistingAuthentication(): void {
    try {
      const accounts = this.msalService.instance.getAllAccounts();
      if (accounts.length > 0) {
        this.handleAuthenticationResult();
      }
    } catch (error) {
      console.error('Microsoft: Error checking existing authentication:', error);
    }
  }

  // Public Methods

  /**
   * Initiate Microsoft login using redirect flow
   */
  public signIn(): void {
    this.isLoadingSubject.next(true);
    
    this.msalService.loginRedirect({
      scopes: ['User.Read'],
      prompt: 'select_account'
    });
  }

  /**
   * Initiate Microsoft login using popup flow
   */
  public signInPopup(): Observable<void> {
    this.isLoadingSubject.next(true);
    
    return new Observable(observer => {
      this.msalService.loginPopup({
        scopes: ['User.Read'],
        prompt: 'select_account'
      }).subscribe({
        next: (result) => {
          console.log('Microsoft: Popup login successful');
          this.handleAuthenticationResult();
          observer.next();
          observer.complete();
        },
        error: (error) => {
          console.error('Microsoft: Popup login failed:', error);
          this.isLoadingSubject.next(false);
          observer.error(error);
        }
      });
    });
  }

  /**
   * Sign out the current user
   */
  public signOut(): void {
    this.isLoadingSubject.next(true);
    
    this.msalService.logoutRedirect({
      postLogoutRedirectUri: window.location.origin
    });
  }

  /**
   * Sign out using popup
   */
  public signOutPopup(): Observable<void> {
    this.isLoadingSubject.next(true);
    
    return new Observable(observer => {
      this.msalService.logoutPopup().subscribe({
        next: () => {
          this.clearUserState();
          observer.next();
          observer.complete();
        },
        error: (error) => {
          console.error('Microsoft: Popup logout failed:', error);
          this.isLoadingSubject.next(false);
          observer.error(error);
        }
      });
    });
  }

  /**
   * Get current user synchronously
   */
  public getCurrentUser(): MicrosoftUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current user profile synchronously
   */
  public getCurrentProfile(): MicrosoftUserProfile | null {
    return this.userProfileSubject.value;
  }

  /**
   * Check if user is currently authenticated
   */
  public isUserAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Get access token for Microsoft Graph API
   */
  public async getAccessToken(scopes: string[] = ['User.Read']): Promise<string | null> {
    try {
      const activeAccount = this.msalService.instance.getActiveAccount();
      if (!activeAccount) return null;

      const tokenResponse = await this.msalService.acquireTokenSilent({
        scopes,
        account: activeAccount
      }).toPromise();

      return tokenResponse?.accessToken || null;
    } catch (error) {
      console.error('Microsoft: Error getting access token:', error);
      return null;
    }
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  public async makeGraphApiCall<T>(endpoint: string, scopes: string[] = ['User.Read']): Promise<T | null> {
    try {
      const accessToken = await this.getAccessToken(scopes);
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Graph API call failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Microsoft: Graph API call failed:', error);
      return null;
    }
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
  
  /**
   * Get current loading state synchronously
  */
  public getCurrentLoadingState(): boolean {
    return this.isLoadingSubject.value;
  }
}