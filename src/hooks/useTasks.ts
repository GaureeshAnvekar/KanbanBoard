import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NewTaskInput, Task, TaskStatus, TeamMember } from '../types/task'
import { TASK_COLUMNS } from '../types/task'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type TaskState = {
  tasks: Task[]
  tasksByStatus: Record<TaskStatus, Task[]>
  isLoading: boolean
  error: string | null
  createTask: (input: NewTaskInput) => Promise<void>
  reorderTask: (taskId: string, overId: string) => Promise<void>
  refreshTasks: () => Promise<void>
}

function createEmptyGroups() {
  return TASK_COLUMNS.reduce(
    (groups, column) => ({ ...groups, [column.id]: [] }),
    {} as Record<TaskStatus, Task[]>,
  )
}

type TaskRow = Omit<Task, 'assignees'>

type AssignmentRow = {
  task_id: string
  team_member_id: string
}

function attachAssignees(
  taskRows: TaskRow[],
  assignments: AssignmentRow[],
  teamMembers: TeamMember[],
): Task[] {
  const membersById = new Map(teamMembers.map((member) => [member.id, member]))

  return taskRows.map((task) => ({
    ...task,
    assignees: assignments
      .filter((assignment) => assignment.task_id === task.id)
      .map((assignment) => membersById.get(assignment.team_member_id))
      .filter((member): member is TeamMember => Boolean(member)),
  }))
}

function sortTasks(taskList: Task[]) {
  return [...taskList].sort((first, second) => {
    if (first.status === second.status) {
      return first.position - second.position || first.created_at.localeCompare(second.created_at)
    }

    return first.status.localeCompare(second.status)
  })
}

function normalizeColumn(columnTasks: Task[]) {
  return columnTasks.map((task, index) => ({ ...task, position: index }))
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)

  return nextItems
}

function getStatusFromId(id: string, tasks: Task[]): TaskStatus | null {
  const column = TASK_COLUMNS.find((candidate) => candidate.id === id)

  if (column) {
    return column.id
  }

  return tasks.find((task) => task.id === id)?.status ?? null
}

function buildReorderedTasks(tasks: Task[], taskId: string, overId: string) {
  const activeTask = tasks.find((task) => task.id === taskId)
  const nextStatus = getStatusFromId(overId, tasks)

  if (!activeTask || !nextStatus) {
    return tasks
  }

  const isOverColumn = TASK_COLUMNS.some((column) => column.id === overId)
  const withoutActive = tasks.filter((task) => task.id !== taskId)
  const activeTaskInNextStatus = { ...activeTask, status: nextStatus }
  const originalTargetTasks = sortTasks(tasks.filter((task) => task.status === nextStatus))
  const targetColumnTasks = sortTasks(withoutActive.filter((task) => task.status === nextStatus))
  const overTaskIndex = targetColumnTasks.findIndex((task) => task.id === overId)
  const targetIndex = isOverColumn ? targetColumnTasks.length : overTaskIndex

  if (!isOverColumn && targetIndex === -1) {
    return tasks
  }

  const nextTargetTasks =
    activeTask.status === nextStatus && !isOverColumn
      ? moveArrayItem(
          originalTargetTasks,
          originalTargetTasks.findIndex((task) => task.id === taskId),
          originalTargetTasks.findIndex((task) => task.id === overId),
        )
      : [
          ...targetColumnTasks.slice(0, targetIndex),
          activeTaskInNextStatus,
          ...targetColumnTasks.slice(targetIndex),
        ]
  const affectedStatuses = new Set([activeTask.status, nextStatus])
  const untouchedTasks = withoutActive.filter((task) => !affectedStatuses.has(task.status))
  const normalizedSourceTasks =
    activeTask.status === nextStatus
      ? []
      : normalizeColumn(sortTasks(withoutActive.filter((task) => task.status === activeTask.status)))

  return sortTasks([
    ...untouchedTasks,
    ...normalizedSourceTasks,
    ...normalizeColumn(nextTargetTasks),
  ])
}

async function loadTasksWithAssignees(userId: string) {
  if (!supabase) {
    return { data: [] as Task[], error: null }
  }

  const [tasksResponse, assignmentsResponse, teamResponse] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .order('status', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('task_assignees').select('task_id, team_member_id').eq('user_id', userId),
    supabase.from('team_members').select('*').order('created_at', { ascending: true }),
  ])

  const error = tasksResponse.error ?? assignmentsResponse.error ?? teamResponse.error

  if (error) {
    return { data: [] as Task[], error }
  }

  return {
    data: sortTasks(
      attachAssignees(
        (tasksResponse.data ?? []) as TaskRow[],
        (assignmentsResponse.data ?? []) as AssignmentRow[],
        (teamResponse.data ?? []) as TeamMember[],
      ),
    ),
    error: null,
  }
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

    const { data, error: loadError } = await loadTasksWithAssignees(userId)

    if (loadError) {
      setError(loadError.message)
      setIsLoading(false)
      return
    }

    setTasks(data)
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

      const { data, error: loadError } = await loadTasksWithAssignees(userId)

      if (!isMounted) {
        return
      }

      if (loadError) {
        setError(loadError.message)
        setIsLoading(false)
        return
      }

      setTasks(data)
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

      const nextPosition =
        tasks
          .filter((task) => task.status === 'todo')
          .reduce((highest, task) => Math.max(highest, task.position), -1) + 1

      const { data, error: createError } = await supabase
        .from('tasks')
        .insert({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          priority: input.priority,
          due_date: input.dueDate || null,
          status: 'todo',
          position: nextPosition,
          user_id: userId,
        })
        .select()
        .single()

      if (createError) {
        setError(createError.message)
        return
      }

      if (input.assigneeIds.length) {
        const { error: assignmentError } = await supabase.from('task_assignees').insert(
          input.assigneeIds.map((teamMemberId) => ({
            task_id: data.id,
            team_member_id: teamMemberId,
            user_id: userId,
          })),
        )

        if (assignmentError) {
          setError(assignmentError.message)
          return
        }
      }

      const { data: refreshedTasks, error: refreshError } = await loadTasksWithAssignees(userId)

      if (refreshError) {
        setTasks((current) => sortTasks([...current, { ...data, assignees: [] }]))
        setError(refreshError.message)
        return
      }

      setTasks(refreshedTasks)
    },
    [tasks, userId],
  )

  const reorderTask = useCallback(async (taskId: string, overId: string) => {
    const nextTasks = buildReorderedTasks(tasks, taskId, overId)

    if (!supabase || nextTasks === tasks) {
      return
    }

    const supabaseClient = supabase
    const previousTasks = tasks
    setTasks(nextTasks)
    setError(null)

    const changedTasks = nextTasks.filter((nextTask) => {
      const previousTask = previousTasks.find((task) => task.id === nextTask.id)

      return previousTask?.status !== nextTask.status || previousTask?.position !== nextTask.position
    })

    const updates = await Promise.all(
      changedTasks.map((task) =>
        supabaseClient
          .from('tasks')
          .update({ status: task.status, position: task.position })
          .eq('id', task.id),
      ),
    )

    const updateError = updates.find((response) => response.error)?.error

    if (updateError) {
      setTasks(previousTasks)
      setError(updateError.message)
    }
  }, [tasks])

  const tasksByStatus = useMemo(() => {
    return sortTasks(tasks).reduce(
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
    reorderTask,
    refreshTasks,
  }
}
