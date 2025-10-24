import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>',
  styles: []
})
export class AppRootComponent implements OnInit {
  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      await this.supabaseService.initialize();
      
      // Check if user is authenticated
      const session = await this.supabaseService.getSession();
      
      // Public routes that don't require authentication
      const publicRoutes = ['/login', '/health'];
      const isPublicRoute = publicRoutes.includes(this.router.url);
      
      // Only redirect if we're not already on a public route
      if (!session && !isPublicRoute) {
        this.router.navigate(['/login']);
      } else if (session && this.router.url === '/login') {
        this.router.navigate(['/home']);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      // If Supabase is not configured, redirect to login unless on health check
      if (this.router.url !== '/login' && this.router.url !== '/health') {
        this.router.navigate(['/login']);
      }
    }
  }
}
