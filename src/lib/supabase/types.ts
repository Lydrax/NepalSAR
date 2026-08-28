import {
  DisasterType,
  ImmediateDangerSituation,
  InjuryLevel,
  LocationSource,
  PriorityLevel,
  RescueCaseStatus,
  ResponderRole,
} from '../types/emergency';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          organization: string | null;
          role: ResponderRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          organization?: string | null;
          role?: ResponderRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          organization?: string | null;
          role?: ResponderRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      rescue_requests: {
        Row: {
          id: string;
          case_number: string;
          client_request_id: string;
          created_at: string;
          updated_at: string;
          latitude: number | null;
          longitude: number | null;
          location_accuracy: number | null;
          location_timestamp: string | null;
          location_source: LocationSource;
          manual_location_description: string | null;
          people_count: number;
          trapped_status: ImmediateDangerSituation;
          injury_level: InjuryLevel;
          disaster_type: DisasterType;
          disaster_other: string | null;
          description: string | null;
          phone_number: string | null;
          priority: PriorityLevel;
          status: RescueCaseStatus;
          assigned_to: string | null;
          resolved_at: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          case_number?: string;
          client_request_id: string;
          created_at?: string;
          updated_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_accuracy?: number | null;
          location_timestamp?: string | null;
          location_source?: LocationSource;
          manual_location_description?: string | null;
          people_count?: number;
          trapped_status: ImmediateDangerSituation;
          injury_level: InjuryLevel;
          disaster_type: DisasterType;
          disaster_other?: string | null;
          description?: string | null;
          phone_number?: string | null;
          priority: PriorityLevel;
          status?: RescueCaseStatus;
          assigned_to?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          case_number?: string;
          client_request_id?: string;
          created_at?: string;
          updated_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_accuracy?: number | null;
          location_timestamp?: string | null;
          location_source?: LocationSource;
          manual_location_description?: string | null;
          people_count?: number;
          trapped_status?: ImmediateDangerSituation;
          injury_level?: InjuryLevel;
          disaster_type?: DisasterType;
          disaster_other?: string | null;
          description?: string | null;
          phone_number?: string | null;
          priority?: PriorityLevel;
          status?: RescueCaseStatus;
          assigned_to?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rescue_requests_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      rescue_request_access: {
        Row: {
          id: string;
          rescue_request_id: string;
          token_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rescue_request_id: string;
          token_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          rescue_request_id?: string;
          token_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rescue_request_access_rescue_request_id_fkey';
            columns: ['rescue_request_id'];
            isOneToOne: true;
            referencedRelation: 'rescue_requests';
            referencedColumns: ['id'];
          }
        ];
      };
      rescue_request_events: {
        Row: {
          id: string;
          rescue_request_id: string;
          created_at: string;
          actor_user_id: string | null;
          event_type: string;
          old_status: RescueCaseStatus | null;
          new_status: RescueCaseStatus | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          rescue_request_id: string;
          created_at?: string;
          actor_user_id?: string | null;
          event_type: string;
          old_status?: RescueCaseStatus | null;
          new_status?: RescueCaseStatus | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          rescue_request_id?: string;
          created_at?: string;
          actor_user_id?: string | null;
          event_type?: string;
          old_status?: RescueCaseStatus | null;
          new_status?: RescueCaseStatus | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rescue_request_events_rescue_request_id_fkey';
            columns: ['rescue_request_id'];
            isOneToOne: false;
            referencedRelation: 'rescue_requests';
            referencedColumns: ['id'];
          }
        ];
      };
      rescue_request_photos: {
        Row: {
          id: string;
          rescue_request_id: string;
          storage_path: string;
          created_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          id?: string;
          rescue_request_id: string;
          storage_path: string;
          created_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          rescue_request_id?: string;
          storage_path?: string;
          created_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rescue_request_photos_rescue_request_id_fkey';
            columns: ['rescue_request_id'];
            isOneToOne: false;
            referencedRelation: 'rescue_requests';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_case_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      responder_role: ResponderRole;
      rescue_priority: PriorityLevel;
      rescue_status: RescueCaseStatus;
      immediate_danger: ImmediateDangerSituation;
      injury_level: InjuryLevel;
      disaster_type: DisasterType;
      location_source: LocationSource;
    };
  };
}
