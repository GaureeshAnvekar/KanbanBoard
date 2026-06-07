export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

export type TaskPriority = 'low' | 'normal' | 'high'

export type Task = {
  id: string
  title: string
  status: TaskStatus
  user_id: string
  created_at: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
}

export type NewTaskInput = {
  title: string
  description?: string
  priority: TaskPriority
  dueDate?: string
}

export type TaskColumn = {
  id: TaskStatus
  title: string
  accent: string
  description: string
}

export const TASK_COLUMNS: TaskColumn[] = [
  {
    id: 'todo',
    title: 'To Do',
    accent: 'slate',
    description: 'Ideas and upcoming work',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    accent: 'blue',
    description: 'Actively being built',
  },
  {
    id: 'in_review',
    title: 'In Review',
    accent: 'violet',
    description: 'Ready for feedback',
  },
  {
    id: 'done',
    title: 'Done',
    accent: 'green',
    description: 'Shipped and complete',
  },
]
