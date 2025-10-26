import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

import { AppRootComponent } from './app-root.component';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { HealthComponent } from './health/health.component';
import { InterestsComponent } from './interests/interests.component';
import { OpenaiService } from './services/openai.service';
import { SupabaseService } from './services/supabase.service';
import { MigrationService } from './services/migration.service';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: AppComponent, canActivate: [AuthGuard] },
  { path: 'interests', component: InterestsComponent, canActivate: [AuthGuard] },
  { path: 'health', component: HealthComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];

function initializeApp(supabaseService: SupabaseService) {
  return () => supabaseService.initialize();
}

@NgModule({
  declarations: [
    AppRootComponent,
    AppComponent,
    LoginComponent,
    HealthComponent,
    InterestsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    RouterModule.forRoot(routes),
    MatButtonModule,
    MatChipsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule
  ],
  providers: [
    OpenaiService, 
    SupabaseService, 
    MigrationService,
    AuthGuard,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [SupabaseService],
      multi: true
    }
  ],
  bootstrap: [AppRootComponent]
})
export class AppModule { }
