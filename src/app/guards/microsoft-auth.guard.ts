import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { MicrosoftAuthService } from '../services/microsoft-auth.service';

@Injectable({
  providedIn: 'root'
})
export class MicrosoftAuthGuard implements CanActivate {
  constructor(
    private microsoftAuth: MicrosoftAuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.microsoftAuth.isAuthenticated$.pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        } else {
          return this.router.createUrlTree(['/login']);
        }
      })
    );
  }
}