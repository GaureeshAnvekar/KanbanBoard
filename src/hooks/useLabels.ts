import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { NewLabelInput, TaskLabel } from '../types/task'

type LabelsState = {
  labels: TaskLabel[]
  isLoading: boolean
  error: string | null
  createLabel: (input: NewLabelInput) => Promise<void>
  refreshLabels: () => Promise<void>
}

export function useLabels(userId?: string): LabelsState {
  const [labels, setLabels] = useState<TaskLabel[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  const refreshLabels = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setLabels([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase
      .from('labels')
      .select('*')
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setLabels(data ?? [])
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    let isMounted = true

    async function loadInitialLabels() {
      await Promise.resolve()

      if (!isMounted) {
        return
      }

      await refreshLabels()
    }

    void loadInitialLabels()

    return () => {
      isMounted = false
    }
  }, [refreshLabels])

  const createLabel = useCallback(
    async (input: NewLabelInput) => {
      if (!supabase || !userId) {
        setError('A guest session is required before adding labels.')
        return
      }

      setError(null)

      const { data, error: createError } = await supabase
        .from('labels')
        .insert({
          name: input.name.trim(),
          color: input.color,
          user_id: userId,
        })
        .select()
        .single()

      if (createError) {
        setError(createError.message)
        return
      }

      setLabels((current) => [...current, data])
    },
    [userId],
  )

  return {
    labels,
    isLoading,
    error,
    createLabel,
    refreshLabels,
  }
}
