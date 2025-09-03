import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MicrosoftAuthService, MicrosoftUser } from './microsoft-auth.service';
import { GoogleAuthService, GoogleUser } from './google-auth.service';

export interface UnifiedUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'microsoft' | 'google';
  rawData: MicrosoftUser | GoogleUser;
}

export type AuthProvider = 'microsoft' | 'google' | null;

@Injectable({
  providedIn: 'root'
})
export class AuthManagerService {
  private currentUserSubject = new BehaviorSubject<UnifiedUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private currentProviderSubject = new BehaviorSubject<AuthProvider>(null);
  public currentProvider$ = this.currentProviderSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private microsoftAuth: MicrosoftAuthService,
    private googleAuth: GoogleAuthService
  ) {
    this.initializeAuthManager();
  }

  private initializeAuthManager(): void {
    // Listen to Microsoft auth changes
    this.microsoftAuth.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        const user = this.microsoftAuth.getCurrentUser();
        if (user) {
          this.setCurrentUser(this.mapMicrosoftUser(user), 'microsoft');
        }
      } else if (this.currentProviderSubject.value === 'microsoft') {
        this.clearCurrentUser();
      }
    });

    // Listen to Google auth changes
    this.googleAuth.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        const user = this.googleAuth.getCurrentUser();
        if (user) {
          this.setCurrentUser(this.mapGoogleUser(user), 'google');
        }
      } else if (this.currentProviderSubject.value === 'google') {
        this.clearCurrentUser();
      }
    });
  }

  private mapMicrosoftUser(user: MicrosoftUser): UnifiedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: undefined, // Microsoft doesn't provide picture in basic profile
      provider: 'microsoft',
      rawData: user
    };
  }

  private mapGoogleUser(user: GoogleUser): UnifiedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: 'google',
      rawData: user
    };
  }

  private setCurrentUser(user: UnifiedUser, provider: AuthProvider): void {
    this.currentUserSubject.next(user);
    this.currentProviderSubject.next(provider);
    this.isAuthenticatedSubject.next(true);
  }

  private clearCurrentUser(): void {
    this.currentUserSubject.next(null);
    this.currentProviderSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  // Public methods for authentication
  public signInWithMicrosoft(): void {
    this.microsoftAuth.signIn();
  }

  public signInWithMicrosoftPopup(): Observable<void> {
    return this.microsoftAuth.signInPopup();
  }

  public signInWithGoogle(): void {
    this.googleAuth.signIn();
  }

  public async signOut(): Promise<void> {
    const currentProvider = this.currentProviderSubject.value;
    
    try {
      if (currentProvider === 'microsoft') {
        this.microsoftAuth.signOut();
      } else if (currentProvider === 'google') {
        await this.googleAuth.signOut();
      }
    } catch (error) {
      console.error('Error during sign out:', error);
    }
    
    this.clearCurrentUser();
  }

  public getCurrentUser(): UnifiedUser | null {
    return this.currentUserSubject.value;
  }

  public getCurrentProvider(): AuthProvider {
    return this.currentProviderSubject.value;
  }

  public isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  public isLoading(): boolean {
    const provider = this.currentProviderSubject.value;
    if (provider === 'microsoft') {
        return this.microsoftAuth.getCurrentLoadingState();
    } else if (provider === 'google') {
        return this.googleAuth.getCurrentLoadingState();
    }
    return false;
    }
}