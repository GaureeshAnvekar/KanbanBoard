import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, parseISO } from 'date-fns'
import { AlertCircle, Calendar, CheckCircle2, Clock3, Loader2, Plus, Sparkles } from 'lucide-react'
import './App.css'
import { useGuestSession } from './hooks/useGuestSession'
import { useTasks } from './hooks/useTasks'
import { TASK_COLUMNS, type NewTaskInput, type Task, type TaskPriority, type TaskStatus } from './types/task'

const priorityTone: Record<TaskPriority, string> = {
  low: 'priority-low',
  normal: 'priority-normal',
  high: 'priority-high',
}

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
}

function App() {
  const { session, isLoading: isSessionLoading, error: sessionError } = useGuestSession()
  const { tasks, tasksByStatus, isLoading, error, createTask, moveTask, refreshTasks } = useTasks(
    session?.user.id,
  )
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const stats = useMemo(() => {
    const completed = tasksByStatus.done.length
    const open = tasks.length - completed

    return { completed, open }
  }, [tasks.length, tasksByStatus.done.length])

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((candidate) => candidate.id === event.active.id)
    setActiveTask(task ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const nextStatus = event.over?.id as TaskStatus | undefined
    const taskId = event.active.id as string

    setActiveTask(null)

    if (!nextStatus || !TASK_COLUMNS.some((column) => column.id === nextStatus)) {
      return
    }

    await moveTask(taskId, nextStatus)
  }

  const blockingError = sessionError || error

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="page-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            Sportlingo Workspace
          </div>
          <h1 id="page-title">A polished Kanban board for focused team flow.</h1>
          <p>
            Create tasks, prioritize work, and drag cards through a clean visual workflow powered by
            Supabase guest sessions.
          </p>
        </div>

        <div className="hero-card" aria-label="Board summary">
          <div>
            <span className="summary-label">Open work</span>
            <strong>{stats.open}</strong>
          </div>
          <div>
            <span className="summary-label">Completed</span>
            <strong>{stats.completed}</strong>
          </div>
          <div>
            <span className="summary-label">Guest ID</span>
            <code>{session?.user.id.slice(0, 8) ?? 'starting'}</code>
          </div>
        </div>
      </section>

      {blockingError ? <ErrorBanner message={blockingError} onRetry={refreshTasks} /> : null}

      <TaskComposer
        disabled={!session || isSessionLoading}
        isBooting={isSessionLoading}
        onCreate={createTask}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <section className="board" aria-label="Task board">
          {TASK_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              isLoading={isLoading || isSessionLoading}
              tasks={tasksByStatus[column.id]}
            />
          ))}
        </section>

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} isOverlay /> : null}</DragOverlay>
      </DndContext>
    </main>
  )
}

function TaskComposer({
  disabled,
  isBooting,
  onCreate,
}: {
  disabled: boolean
  isBooting: boolean
  onCreate: (input: NewTaskInput) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSaving(true)
    await onCreate({ title, description, priority, dueDate })
    setTitle('')
    setDescription('')
    setPriority('normal')
    setDueDate('')
    setIsSaving(false)
  }

  return (
    <form className="task-composer" onSubmit={handleSubmit}>
      <div className="composer-main">
        <label htmlFor="task-title">New task</label>
        <input
          id="task-title"
          placeholder="Design the onboarding flow"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={disabled || isSaving}
        />
        <textarea
          placeholder="Add context, acceptance criteria, or links..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={disabled || isSaving}
        />
      </div>

      <div className="composer-actions">
        <label>
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            disabled={disabled || isSaving}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={disabled || isSaving}
          />
        </label>
        <button type="submit" disabled={disabled || isSaving || !title.trim()}>
          {isSaving || isBooting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Add task
        </button>
      </div>
    </form>
  )
}

function KanbanColumn({
  column,
  tasks,
  isLoading,
}: {
  column: (typeof TASK_COLUMNS)[number]
  tasks: Task[]
  isLoading: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id })

  return (
    <section ref={setNodeRef} className={`kanban-column ${isOver ? 'is-over' : ''}`}>
      <header className="column-header">
        <div>
          <span className={`column-dot ${column.accent}`} />
          <h2>{column.title}</h2>
        </div>
        <span className="task-count">{tasks.length}</span>
      </header>
      <p className="column-description">{column.description}</p>

      <div className="task-stack">
        {isLoading ? (
          <LoadingCards />
        ) : tasks.length ? (
          tasks.map((task) => <DraggableTaskCard key={task.id} task={task} />)
        ) : (
          <EmptyState status={column.id} />
        )}
      </div>
    </section>
  )
}

function DraggableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'dragging-card' : undefined}
      {...listeners}
      {...attributes}
    >
      <TaskCard task={task} />
    </div>
  )
}

function TaskCard({ task, isOverlay = false }: { task: Task; isOverlay?: boolean }) {
  const dueMeta = getDueMeta(task.due_date)

  return (
    <article className={`task-card ${isOverlay ? 'task-card-overlay' : ''}`}>
      <div className="card-topline">
        <span className={`priority-pill ${priorityTone[task.priority]}`}>
          {priorityLabel[task.priority]}
        </span>
        {task.status === 'done' ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
      </div>
      <h3>{task.title}</h3>
      {task.description ? <p>{task.description}</p> : null}
      <footer>
        {dueMeta ? (
          <span className={dueMeta.isLate ? 'due-date late' : 'due-date'}>
            <Calendar size={14} />
            {dueMeta.label}
          </span>
        ) : (
          <span className="due-date muted">No due date</span>
        )}
      </footer>
    </article>
  )
}

function EmptyState({ status }: { status: TaskStatus }) {
  const copy: Record<TaskStatus, string> = {
    todo: 'Capture new work above and it will land here.',
    in_progress: 'Drag a task here when work begins.',
    in_review: 'Move finished work here for review.',
    done: 'Completed work will stack up here.',
  }

  return (
    <div className="empty-state">
      <span />
      <p>{copy[status]}</p>
    </div>
  )
}

function LoadingCards() {
  return (
    <>
      <div className="skeleton-card" />
      <div className="skeleton-card short" />
    </>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  const [isRetrying, setIsRetrying] = useState(false)

  async function handleRetry() {
    setIsRetrying(true)
    await onRetry()
    setIsRetrying(false)
  }

  return (
    <div className="error-banner" role="alert">
      <AlertCircle size={20} />
      <p>{message}</p>
      <button type="button" onClick={handleRetry} disabled={isRetrying}>
        Retry
      </button>
    </div>
  )
}

function getDueMeta(dueDate: string | null) {
  if (!dueDate) {
    return null
  }

  const parsedDate = parseISO(dueDate)

  return {
    label: format(parsedDate, 'MMM d'),
    isLate: isPast(parsedDate),
  }
}

export default App
