import { createClient } from '@supabase/supabase-js'
import type { TaskPriority, TaskStatus } from '../types/task'

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          title: string
          status: TaskStatus
          user_id: string
          created_at: string
          description: string | null
          priority: TaskPriority
          due_date: string | null
          position: number
        }
        Insert: {
          id?: string
          title: string
          status?: TaskStatus
          user_id?: string
          created_at?: string
          description?: string | null
          priority?: TaskPriority
          due_date?: string | null
          position?: number
        }
        Update: {
          id?: string
          title?: string
          status?: TaskStatus
          user_id?: string
          created_at?: string
          description?: string | null
          priority?: TaskPriority
          due_date?: string | null
          position?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          user_id: string
          name: string
          avatar_url: string | null
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          avatar_url?: string | null
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          avatar_url?: string | null
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          task_id: string
          team_member_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          task_id: string
          team_member_id: string
          user_id?: string
          created_at?: string
        }
        Update: {
          task_id?: string
          team_member_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      task_labels: {
        Row: {
          task_id: string
          label_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          task_id: string
          label_id: string
          user_id?: string
          created_at?: string
        }
        Update: {
          task_id?: string
          label_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id?: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export type { Json }
