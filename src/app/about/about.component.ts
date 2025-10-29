import { Component, OnInit } from '@angular/core';
import { TelemetryService } from '../services/telemetry.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(private telemetryService: TelemetryService) { }

  ngOnInit(): void {
    // Record page view for telemetry
    this.telemetryService.recordPageView('about');
  }

  getEnvironment(): string {
    if (window.location.hostname === 'kanni-ai.de') {
      return 'Production';
    } else if (window.location.hostname.includes('kanni-ai')) {
      return 'Staging';
    }
    return 'Development';
  }
}