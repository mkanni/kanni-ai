import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class MigrationService {
  constructor(private supabaseService: SupabaseService) {}

  async migrateInterestsFromEnvToDatabase(): Promise<void> {
    try {
      // Check if user is authenticated
      const currentUser = this.supabaseService.user;
      if (!currentUser) {
        console.log('User not authenticated, skipping migration');
        return;
      }

      // Check if user already has interests in database
      const existingInterests = await this.supabaseService.getUserInterests();
      if (existingInterests.length > 0) {
        console.log('User already has interests in database, skipping migration');
        return;
      }

      // Get interests from environment variables
      let envInterests: string[] = [];
      if (window.env && window.env.INTERESTS) {
        envInterests = window.env.INTERESTS.split(',').map((i: string) => i.trim()).filter(i => i.length > 0);
      }

      if (envInterests.length === 0) {
        console.log('No interests found in environment variables');
        return;
      }

      console.log('Migrating interests from environment to database:', envInterests);

      // Add each interest to the database
      for (const interest of envInterests) {
        try {
          await this.supabaseService.addUserInterest(interest);
          console.log(`Successfully migrated interest: ${interest}`);
        } catch (error) {
          console.error(`Failed to migrate interest "${interest}":`, error);
        }
      }

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }
}