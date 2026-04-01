export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Minimal typed surface for app-owned tables we write with service role.
 * Extend this as more admin-side tables need strict typing.
 */
export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          user_id: string | null;
          address: string | null;
          postcode: string | null;
          city: string | null;
          property_type: string | null;
          bedrooms: number | null;
          bathrooms: number | null;
          monthly_rent: number | null;
          status: string | null;
          marketing_description: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          user_id: string;
          address?: string | null;
          postcode?: string | null;
          city?: string | null;
          property_type?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          monthly_rent?: number | null;
          status?: string | null;
          marketing_description?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          address?: string | null;
          postcode?: string | null;
          city?: string | null;
          property_type?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          monthly_rent?: number | null;
          status?: string | null;
          marketing_description?: string | null;
          created_at?: string | null;
        };
      };
      system_alerts: {
        Row: {
          id: string;
          alert_type: string;
          message: string;
          error_details: Json | null;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          alert_type: string;
          message: string;
          error_details?: Json | null;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          alert_type?: string;
          message?: string;
          error_details?: Json | null;
          resolved?: boolean;
          created_at?: string;
        };
      };
    };
  };
}
