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
