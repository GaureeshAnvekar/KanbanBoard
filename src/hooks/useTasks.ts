import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NewTaskInput, Task, TaskStatus } from '../types/task'
import { TASK_COLUMNS } from '../types/task'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type TaskState = {
  tasks: Task[]
  tasksByStatus: Record<TaskStatus, Task[]>
  isLoading: boolean
  error: string | null
  createTask: (input: NewTaskInput) => Promise<void>
  moveTask: (taskId: string, nextStatus: TaskStatus) => Promise<void>
  refreshTasks: () => Promise<void>
}

function createEmptyGroups() {
  return TASK_COLUMNS.reduce(
    (groups, column) => ({ ...groups, [column.id]: [] }),
    {} as Record<TaskStatus, Task[]>,
  )
}

export function useTasks(userId?: string): TaskState {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  const refreshTasks = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setTasks([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setTasks(data ?? [])
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    let isMounted = true

    async function loadInitialTasks() {
      await Promise.resolve()

      if (!isMounted) {
        return
      }

      if (!isSupabaseConfigured || !supabase || !userId) {
        setTasks([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const { data, error: loadError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true })

      if (!isMounted) {
        return
      }

      if (loadError) {
        setError(loadError.message)
        setIsLoading(false)
        return
      }

      setTasks(data ?? [])
      setIsLoading(false)
    }

    void loadInitialTasks()

    return () => {
      isMounted = false
    }
  }, [userId])

  const createTask = useCallback(
    async (input: NewTaskInput) => {
      if (!supabase || !userId) {
        setError('A guest session is required before creating tasks.')
        return
      }

      setError(null)

      const { data, error: createError } = await supabase
        .from('tasks')
        .insert({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          priority: input.priority,
          due_date: input.dueDate || null,
          status: 'todo',
          user_id: userId,
        })
        .select()
        .single()

      if (createError) {
        setError(createError.message)
        return
      }

      setTasks((current) => [...current, data])
    },
    [userId],
  )

  const moveTask = useCallback(async (taskId: string, nextStatus: TaskStatus) => {
    const task = tasks.find((candidate) => candidate.id === taskId)

    if (!supabase || !task || task.status === nextStatus) {
      return
    }

    const previousTasks = tasks
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === taskId ? { ...candidate, status: nextStatus } : candidate,
      ),
    )
    setError(null)

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', taskId)

    if (updateError) {
      setTasks(previousTasks)
      setError(updateError.message)
    }
  }, [tasks])

  const tasksByStatus = useMemo(() => {
    return tasks.reduce(
      (groups, task) => {
        groups[task.status].push(task)
        return groups
      },
      createEmptyGroups(),
    )
  }, [tasks])

  return {
    tasks,
    tasksByStatus,
    isLoading,
    error,
    createTask,
    moveTask,
    refreshTasks,
  }
}
