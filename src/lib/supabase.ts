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
