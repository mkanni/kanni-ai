import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    console.log('Auth guard checking session...');
    const session = await this.supabaseService.getSession();
    
    if (session) {
      console.log('Session valid, allowing access to:', state.url);
      return true;
    }

    console.log('No session, redirecting to login');
    // Redirect to login page
    this.router.navigate(['/login']);
    return false;
  }
}
