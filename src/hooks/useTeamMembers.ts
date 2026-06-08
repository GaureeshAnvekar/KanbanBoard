import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { NewTeamMemberInput, TeamMember } from '../types/task'

type TeamMembersState = {
  teamMembers: TeamMember[]
  isLoading: boolean
  error: string | null
  createTeamMember: (input: NewTeamMemberInput) => Promise<void>
  refreshTeamMembers: () => Promise<void>
}

export function useTeamMembers(userId?: string): TeamMembersState {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  const refreshTeamMembers = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setTeamMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setTeamMembers(data ?? [])
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    let isMounted = true

    async function loadInitialTeamMembers() {
      await Promise.resolve()

      if (!isMounted) {
        return
      }

      await refreshTeamMembers()
    }

    void loadInitialTeamMembers()

    return () => {
      isMounted = false
    }
  }, [refreshTeamMembers])

  const createTeamMember = useCallback(
    async (input: NewTeamMemberInput) => {
      if (!supabase || !userId) {
        setError('A guest session is required before adding team members.')
        return
      }

      setError(null)

      const { data, error: createError } = await supabase
        .from('team_members')
        .insert({
          name: input.name.trim(),
          avatar_url: input.avatarUrl?.trim() || null,
          color: input.color,
          user_id: userId,
        })
        .select()
        .single()

      if (createError) {
        setError(createError.message)
        return
      }

      setTeamMembers((current) => [...current, data])
    },
    [userId],
  )

  return {
    teamMembers,
    isLoading,
    error,
    createTeamMember,
    refreshTeamMembers,
  }
}
