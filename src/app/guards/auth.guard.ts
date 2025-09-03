import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthManagerService } from '../services/auth-manager.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authManager: AuthManagerService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authManager.isAuthenticated$.pipe(
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