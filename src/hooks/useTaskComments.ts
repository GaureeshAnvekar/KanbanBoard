import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { NewTaskCommentInput, TaskComment } from '../types/task'

type TaskCommentsState = {
  comments: TaskComment[]
  isLoading: boolean
  error: string | null
  createComment: (input: NewTaskCommentInput) => Promise<void>
  refreshComments: () => Promise<void>
}

export function useTaskComments(userId?: string, taskId?: string): TaskCommentsState {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(userId && taskId))
  const [error, setError] = useState<string | null>(null)

  const refreshComments = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId || !taskId) {
      setComments([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase
      .from('task_comments')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setComments(data ?? [])
    setIsLoading(false)
  }, [taskId, userId])

  useEffect(() => {
    let isMounted = true

    async function loadInitialComments() {
      await Promise.resolve()

      if (!isMounted) {
        return
      }

      await refreshComments()
    }

    void loadInitialComments()

    return () => {
      isMounted = false
    }
  }, [refreshComments])

  const createComment = useCallback(
    async (input: NewTaskCommentInput) => {
      if (!supabase || !userId) {
        setError('A guest session is required before adding comments.')
        return
      }

      const body = input.body.trim()

      if (!body) {
        return
      }

      setError(null)

      const { data, error: createError } = await supabase
        .from('task_comments')
        .insert({
          task_id: input.taskId,
          body,
          user_id: userId,
        })
        .select()
        .single()

      if (createError) {
        setError(createError.message)
        return
      }

      setComments((current) => [...current, data].sort((first, second) => first.created_at.localeCompare(second.created_at)))
    },
    [userId],
  )

  return {
    comments,
    isLoading,
    error,
    createComment,
    refreshComments,
  }
}
