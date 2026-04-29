export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_actions: {
        Row: {
          agent_type: string
          created_at: string | null
          id: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          id?: string
          payload: Json
          status?: string
          user_id: string
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          id?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_activity: {
        Row: {
          args: Json | null
          created_at: string | null
          id: string
          result: Json | null
          success: boolean | null
          tool_name: string
          user_id: string
        }
        Insert: {
          args?: Json | null
          created_at?: string | null
          id?: string
          result?: Json | null
          success?: boolean | null
          tool_name: string
          user_id: string
        }
        Update: {
          args?: Json | null
          created_at?: string | null
          id?: string
          result?: Json | null
          success?: boolean | null
          tool_name?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_activity_log: {
        Row: {
          action_taken: string | null
          agent_name: string | null
          approved_at: string | null
          created_at: string | null
          id: string
          input_summary: string | null
          output_summary: string | null
          requires_approval: boolean | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          agent_name?: string | null
          approved_at?: string | null
          created_at?: string | null
          id: string
          input_summary?: string | null
          output_summary?: string | null
          requires_approval?: boolean | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          agent_name?: string | null
          approved_at?: string | null
          created_at?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          requires_approval?: boolean | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_run_steps: {
        Row: {
          agent_run_id: string | null
          created_at: string
          detail: Json
          id: string
          step_index: number
          step_type: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          step_index: number
          step_type: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          step_index?: number
          step_type?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_type: string
          created_at: string
          id: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          agent_type: string
          created_at?: string
          id?: string
          payload?: Json
          status?: string
          user_id: string
        }
        Update: {
          agent_type?: string
          created_at?: string
          id?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_records: {
        Row: {
          created_at: string
          expiry_date: string
          id: string
          property_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date: string
          id?: string
          property_id: string
          status: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string
          id?: string
          property_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          is_default: boolean | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          is_default?: boolean | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          is_default?: boolean | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          deposit_amount: number
          document_url: string | null
          end_date: string
          id: string
          landlord_signed_at: string | null
          monthly_rent: number
          property_id: string | null
          sent_at: string | null
          signing_token: string | null
          special_clauses: string | null
          start_date: string
          status: string
          tenancy_id: string | null
          tenant_id: string | null
          tenant_signed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_type: string
          created_at?: string
          deposit_amount: number
          document_url?: string | null
          end_date: string
          id?: string
          landlord_signed_at?: string | null
          monthly_rent: number
          property_id?: string | null
          sent_at?: string | null
          signing_token?: string | null
          special_clauses?: string | null
          start_date: string
          status?: string
          tenancy_id?: string | null
          tenant_id?: string | null
          tenant_signed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          deposit_amount?: number
          document_url?: string | null
          end_date?: string
          id?: string
          landlord_signed_at?: string | null
          monthly_rent?: number
          property_id?: string | null
          sent_at?: string | null
          signing_token?: string | null
          special_clauses?: string | null
          start_date?: string
          status?: string
          tenancy_id?: string | null
          tenant_id?: string | null
          tenant_signed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          body: string
          created_at: string | null
          id: string
          status: string
          subject: string
          tenancy_id: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          status?: string
          subject: string
          tenancy_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          status?: string
          subject?: string
          tenancy_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          agent_run_id: string | null
          agent_type: string
          body: string
          bounce_reason: string | null
          bounced_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          error_message: string | null
          html_body: string | null
          id: string
          max_retries: number | null
          next_retry_at: string | null
          opened_at: string | null
          resend_email_id: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          subject: string
          template_type: string | null
          template_version: number | null
          to_email: string
          to_name: string | null
          unsubscribe_token: string | null
          user_id: string
        }
        Insert: {
          agent_run_id?: string | null
          agent_type: string
          body: string
          bounce_reason?: string | null
          bounced_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          html_body?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          opened_at?: string | null
          resend_email_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status: string
          subject: string
          template_type?: string | null
          template_version?: number | null
          to_email: string
          to_name?: string | null
          unsubscribe_token?: string | null
          user_id: string
        }
        Update: {
          agent_run_id?: string | null
          agent_type?: string
          body?: string
          bounce_reason?: string | null
          bounced_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          html_body?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          opened_at?: string | null
          resend_email_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_type?: string | null
          template_version?: number | null
          to_email?: string
          to_name?: string | null
          unsubscribe_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          html_content: string
          id: string
          is_active: boolean | null
          notes: string | null
          subject_template: string
          template_type: string
          text_content: string
          version: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          subject_template: string
          template_type: string
          text_content: string
          version: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          subject_template?: string
          template_type?: string
          text_content?: string
          version?: number
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email_address: string
          id: string
          reason: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          email_address: string
          id?: string
          reason?: string | null
          unsubscribe_token: string
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          email_address?: string
          id?: string
          reason?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          budget: number | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          move_in_date: string | null
          name: string | null
          notes: string | null
          phone: string | null
          property_id: string | null
          qualified_status: string | null
          source: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          budget?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          move_in_date?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          qualified_status?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          budget?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          move_in_date?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          qualified_status?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          ai_triage_category: string | null
          ai_triage_summary: string | null
          category: string | null
          contractor_email: string | null
          contractor_name: string | null
          created_at: string | null
          description: string | null
          id: string
          landlord_notified_at: string | null
          priority: string | null
          reported_by_tenant: boolean | null
          resolved_at: string | null
          status: string | null
          tenancy_id: string | null
          tenant_acknowledged_at: string | null
          updated_at: string | null
        }
        Insert: {
          ai_triage_category?: string | null
          ai_triage_summary?: string | null
          category?: string | null
          contractor_email?: string | null
          contractor_name?: string | null
          created_at?: string | null
          description?: string | null
          id: string
          landlord_notified_at?: string | null
          priority?: string | null
          reported_by_tenant?: boolean | null
          resolved_at?: string | null
          status?: string | null
          tenancy_id?: string | null
          tenant_acknowledged_at?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_triage_category?: string | null
          ai_triage_summary?: string | null
          category?: string | null
          contractor_email?: string | null
          contractor_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          landlord_notified_at?: string | null
          priority?: string | null
          reported_by_tenant?: boolean | null
          resolved_at?: string | null
          status?: string | null
          tenancy_id?: string | null
          tenant_acknowledged_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          email_log_id: string | null
          id: string
          status: string
          task_name: string
          task_type: string
          tenancy_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          email_log_id?: string | null
          id?: string
          status?: string
          task_name: string
          task_type: string
          tenancy_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          email_log_id?: string | null
          id?: string
          status?: string
          task_name?: string
          task_type?: string
          tenancy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string | null
          id: string
          marketing_description: string | null
          monthly_rent: number | null
          postcode: string | null
          property_type: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string | null
          id: string
          marketing_description?: string | null
          monthly_rent?: number | null
          postcode?: string | null
          property_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string | null
          id?: string
          marketing_description?: string | null
          monthly_rent?: number | null
          postcode?: string | null
          property_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      referencing_events: {
        Row: {
          body_preview: string | null
          created_at: string
          direction: string
          email_log_id: string | null
          id: string
          outcome: string | null
          raw_payload: Json | null
          subject: string | null
          tenancy_id: string
          user_id: string
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          direction: string
          email_log_id?: string | null
          id?: string
          outcome?: string | null
          raw_payload?: Json | null
          subject?: string | null
          tenancy_id: string
          user_id: string
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          direction?: string
          email_log_id?: string | null
          id?: string
          outcome?: string | null
          raw_payload?: Json | null
          subject?: string | null
          tenancy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referencing_events_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referencing_events_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          amount: number | null
          amount_due: number | null
          amount_paid: number | null
          created_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          paid_on: string | null
          payment_link: string | null
          payment_method: string | null
          property_id: string | null
          status: string | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_receipt_url: string | null
          tenancy_id: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string | null
          due_date?: string | null
          id: string
          notes?: string | null
          paid_date?: string | null
          paid_on?: string | null
          payment_link?: string | null
          payment_method?: string | null
          property_id?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_receipt_url?: string | null
          tenancy_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          paid_on?: string | null
          payment_link?: string | null
          payment_method?: string | null
          property_id?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_receipt_url?: string | null
          tenancy_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string
          error_details: Json | null
          id: string
          message: string
          resolved: boolean
        }
        Insert: {
          alert_type: string
          created_at?: string
          error_details?: Json | null
          id?: string
          message: string
          resolved?: boolean
        }
        Update: {
          alert_type?: string
          created_at?: string
          error_details?: Json | null
          id?: string
          message?: string
          resolved?: boolean
        }
        Relationships: []
      }
      tenancies: {
        Row: {
          auto_pay_enabled: boolean | null
          contract_url: string | null
          created_at: string | null
          deposit_amount: number | null
          deposit_protected: boolean | null
          end_date: string | null
          id: string
          monthly_rent: number | null
          move_in_date: string | null
          next_payment_due_date: string | null
          onboarding_status: string
          property_id: string | null
          referencing_agency_email_override: string | null
          referencing_last_inbound_at: string | null
          referencing_last_outbound_at: string | null
          referencing_token: string | null
          start_date: string | null
          status: string | null
          stripe_subscription_id: string | null
          tenant_id: string | null
        }
        Insert: {
          auto_pay_enabled?: boolean | null
          contract_url?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_protected?: boolean | null
          end_date?: string | null
          id: string
          monthly_rent?: number | null
          move_in_date?: string | null
          next_payment_due_date?: string | null
          onboarding_status?: string
          property_id?: string | null
          referencing_agency_email_override?: string | null
          referencing_last_inbound_at?: string | null
          referencing_last_outbound_at?: string | null
          referencing_token?: string | null
          start_date?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          auto_pay_enabled?: boolean | null
          contract_url?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_protected?: boolean | null
          end_date?: string | null
          id?: string
          monthly_rent?: number | null
          move_in_date?: string | null
          next_payment_due_date?: string | null
          onboarding_status?: string
          property_id?: string | null
          referencing_agency_email_override?: string | null
          referencing_last_inbound_at?: string | null
          referencing_last_outbound_at?: string | null
          referencing_token?: string | null
          start_date?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_profiles: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          right_to_rent_status: string | null
          user_id: string | null
          verification_doc_url: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          right_to_rent_status?: string | null
          user_id?: string | null
          verification_doc_url?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          right_to_rent_status?: string | null
          user_id?: string | null
          verification_doc_url?: string | null
        }
        Relationships: []
      }
      user_agent_memory: {
        Row: {
          agent_key: string
          created_at: string
          id: string
          memory_key: string
          memory_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_key: string
          created_at?: string
          id?: string
          memory_key: string
          memory_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_key?: string
          created_at?: string
          id?: string
          memory_key?: string
          memory_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_send_lead_updates: boolean
          auto_send_maintenance_updates: boolean
          auto_send_onboarding_emails: boolean
          auto_send_referencing_emails: boolean
          auto_send_rent_chaser: boolean
          business_address: string | null
          business_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          disqualify_no_movein: boolean | null
          email_from_name: string | null
          email_signoff: string | null
          first_chase_days: number | null
          id: string
          include_payment_plan: boolean | null
          landlord_name: string | null
          lead_qualifier_criteria: string | null
          min_lead_score: number | null
          preferred_sources: string[] | null
          referencing_agency_email: string | null
          referencing_agency_name: string | null
          referencing_agency_notes: string | null
          rent_chaser_instructions: string | null
          rent_chaser_tone: string | null
          stripe_connect_account_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_send_lead_updates?: boolean
          auto_send_maintenance_updates?: boolean
          auto_send_onboarding_emails?: boolean
          auto_send_referencing_emails?: boolean
          auto_send_rent_chaser?: boolean
          business_address?: string | null
          business_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          disqualify_no_movein?: boolean | null
          email_from_name?: string | null
          email_signoff?: string | null
          first_chase_days?: number | null
          id?: string
          include_payment_plan?: boolean | null
          landlord_name?: string | null
          lead_qualifier_criteria?: string | null
          min_lead_score?: number | null
          preferred_sources?: string[] | null
          referencing_agency_email?: string | null
          referencing_agency_name?: string | null
          referencing_agency_notes?: string | null
          rent_chaser_instructions?: string | null
          rent_chaser_tone?: string | null
          stripe_connect_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_send_lead_updates?: boolean
          auto_send_maintenance_updates?: boolean
          auto_send_onboarding_emails?: boolean
          auto_send_referencing_emails?: boolean
          auto_send_rent_chaser?: boolean
          business_address?: string | null
          business_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          disqualify_no_movein?: boolean | null
          email_from_name?: string | null
          email_signoff?: string | null
          first_chase_days?: number | null
          id?: string
          include_payment_plan?: boolean | null
          landlord_name?: string | null
          lead_qualifier_criteria?: string | null
          min_lead_score?: number | null
          preferred_sources?: string[] | null
          referencing_agency_email?: string | null
          referencing_agency_name?: string | null
          referencing_agency_notes?: string | null
          rent_chaser_instructions?: string | null
          rent_chaser_tone?: string | null
          stripe_connect_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_unsubscribe_token: { Args: never; Returns: string }
      is_email_unsubscribed: { Args: { check_email: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

