import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type GuestSessionState = {
  session: Session | null
  isLoading: boolean
  error: string | null
}

export function useGuestSession(): GuestSessionState {
  const [state, setState] = useState<GuestSessionState>({
    session: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    async function ensureGuestSession() {
      if (!isSupabaseConfigured || !supabase) {
        setState({
          session: null,
          isLoading: false,
          error: 'Add your Supabase URL and anon key to .env.local to enable persistence.',
        })
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (sessionError) {
        setState({ session: null, isLoading: false, error: sessionError.message })
        return
      }

      if (session) {
        setState({ session, isLoading: false, error: null })
        return
      }

      const { data, error } = await supabase.auth.signInAnonymously()

      if (!isMounted) return

      setState({
        session: data.session,
        isLoading: false,
        error: error?.message ?? null,
      })
    }

    void ensureGuestSession()

    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setState((current) => ({ ...current, session }))
      }
    })

    return () => {
      isMounted = false
      authListener?.data.subscription.unsubscribe()
    }
  }, [])

  return state
}
