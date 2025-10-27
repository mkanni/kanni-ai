import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

// OpenTelemetry logging will be initialized in the telemetry service

// Start Angular application
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    console.error('Bootstrap error:', err);
  });
