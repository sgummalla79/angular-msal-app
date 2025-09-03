import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

declare const google: any;

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  verified_email: boolean;
  locale?: string;
}

export interface GoogleUserProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService implements OnDestroy {
  private readonly _destroying$ = new Subject<void>();

  // User state
  private currentUserSubject = new BehaviorSubject<GoogleUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Authentication state
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Loading state
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private tokenClient: any;
  private isGoogleLoaded = false;

  constructor(private ngZone: NgZone) {
    this.initializeGoogleAuth();
  }

  private async initializeGoogleAuth(): Promise<void> {
    try {
      await this.loadGoogleScript();
      this.initializeTokenClient();
      this.checkExistingAuth();
    } catch (error) {
      console.error('Google: Failed to initialize Google Auth:', error);
    }
  }

  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.accounts) {
        this.isGoogleLoaded = true;
        resolve();
        return;
      }

      // Check periodically if Google script has loaded
      const checkGoogle = () => {
        if (typeof google !== 'undefined' && google.accounts) {
          this.isGoogleLoaded = true;
          console.log('Google: Script loaded successfully');
          resolve();
        } else {
          setTimeout(checkGoogle, 100);
        }
      };

      checkGoogle();

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isGoogleLoaded) {
          reject(new Error('Google script failed to load'));
        }
      }, 10000);
    });
  }

  private initializeTokenClient(): void {
    if (!this.isGoogleLoaded) return;

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleConfig.clientId, // Replace with your actual Client ID
        scope: 'email profile openid',
        callback: (response: any) => {
          this.ngZone.run(() => {
            this.handleAuthResponse(response);
          });
        },
      });

      console.log('Google: Token client initialized successfully');
    } catch (error) {
      console.error('Google: Error initializing token client:', error);
    }
  }

  private async handleAuthResponse(response: any): Promise<void> {
    if (response.access_token) {
      try {
        this.isLoadingSubject.next(true);

        // Store token
        localStorage.setItem('google_access_token', response.access_token);

        // Fetch user profile
        await this.fetchUserProfile(response.access_token);

        console.log('Google: Authentication successful');
      } catch (error) {
        console.error('Google: Error handling auth response:', error);
        this.clearUserState();
      }
    } else {
      console.error('Google: No access token received');
      this.clearUserState();
    }
  }

  private async fetchUserProfile(accessToken: string): Promise<void> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userInfo: GoogleUserProfile = await response.json();
        const googleUser: GoogleUser = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          verified_email: userInfo.verified_email,
          locale: userInfo.locale,
        };

        this.currentUserSubject.next(googleUser);
        this.isAuthenticatedSubject.next(true);
        console.log('Google: Profile fetched successfully');
      } else {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
    } catch (error) {
      console.error('Google: Error fetching user profile:', error);
      throw error;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  private clearUserState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.isLoadingSubject.next(false);
    localStorage.removeItem('google_access_token');
  }

  private async checkExistingAuth(): Promise<void> {
    const token = this.getStoredToken();
    if (token) {
      try {
        await this.fetchUserProfile(token);
      } catch (error) {
        console.log('Google: Stored token invalid, clearing');
        this.clearUserState();
      }
    }
  }

  private getStoredToken(): string | null {
    return localStorage.getItem('google_access_token');
  }

  // Public Methods

  /**
   * Initiate Google sign-in
   */
  public signIn(): void {
    if (!this.isGoogleLoaded || !this.tokenClient) {
      console.error('Google: Auth not initialized');
      return;
    }

    this.isLoadingSubject.next(true);

    try {
      this.tokenClient.requestAccessToken();
    } catch (error) {
      console.error('Google: Error during sign in:', error);
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      const token = this.getStoredToken();
      if (token && this.isGoogleLoaded) {
        // Revoke the token
        google.accounts.oauth2.revoke(token);
      }

      this.clearUserState();
      console.log('Google: Sign out successful');
    } catch (error) {
      console.error('Google: Error during sign out:', error);
      this.clearUserState(); // Clear anyway
    }
  }

  /**
   * Get current user synchronously
   */
  public getCurrentUser(): GoogleUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is currently authenticated
   */
  public isUserAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Get current access token
   */
  public getAccessToken(): string | null {
    return this.getStoredToken();
  }

  /**
   * Make authenticated request to Google APIs
   */
  public async makeGoogleApiCall<T>(endpoint: string): Promise<T | null> {
    try {
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Google API call failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Google: API call failed:', error);
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
