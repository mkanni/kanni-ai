import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OpenaiService {
  constructor(private http: HttpClient) {}

  generateLearningTip(interests: string[]): Observable<any> {
    // Call Supabase Edge Function
    const functionUrl = `${environment.supabaseUrl}/functions/v1/generate-tip`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${environment.supabaseAnonKey}`,
      'apikey': environment.supabaseAnonKey
    });

    return this.http.post(functionUrl, { interests }, { headers });
  }
}
