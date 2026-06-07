import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, parseISO } from 'date-fns'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import './App.css'
import { useGuestSession } from './hooks/useGuestSession'
import { useTeamMembers } from './hooks/useTeamMembers'
import { useTasks } from './hooks/useTasks'
import {
  TASK_COLUMNS,
  type NewTaskInput,
  type NewTeamMemberInput,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TeamMember,
} from './types/task'

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

const memberColors = ['#4f46e5', '#0891b2', '#16a34a', '#db2777', '#ea580c', '#7c3aed']

function App() {
  const { session, isLoading: isSessionLoading, error: sessionError } = useGuestSession()
  const { tasks, tasksByStatus, isLoading, error, createTask, reorderTask, refreshTasks } = useTasks(
    session?.user.id,
  )
  const {
    teamMembers,
    isLoading: isTeamLoading,
    error: teamError,
    createTeamMember,
    refreshTeamMembers,
  } = useTeamMembers(session?.user.id)
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

    return { completed, open, teamSize: teamMembers.length }
  }, [tasks.length, tasksByStatus.done.length, teamMembers.length])

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((candidate) => candidate.id === event.active.id)
    setActiveTask(task ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id as string | undefined
    const taskId = event.active.id as string

    setActiveTask(null)

    if (!overId) {
      return
    }

    await reorderTask(taskId, overId)
  }

  const blockingError = sessionError || error || teamError

  async function handleRetry() {
    await Promise.all([refreshTasks(), refreshTeamMembers()])
  }

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
            <span className="summary-label">Team</span>
            <strong>{stats.teamSize}</strong>
          </div>
        </div>
      </section>

      {blockingError ? <ErrorBanner message={blockingError} onRetry={handleRetry} /> : null}

      <TaskComposer
        disabled={!session || isSessionLoading}
        isBooting={isSessionLoading}
        teamMembers={teamMembers}
        onCreate={createTask}
      />

      <TeamPanel
        disabled={!session || isSessionLoading}
        isLoading={isTeamLoading}
        teamMembers={teamMembers}
        onCreate={createTeamMember}
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
  teamMembers,
  onCreate,
}: {
  disabled: boolean
  isBooting: boolean
  teamMembers: TeamMember[]
  onCreate: (input: NewTaskInput) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSaving(true)
    await onCreate({ title, description, priority, dueDate, assigneeIds })
    setTitle('')
    setDescription('')
    setPriority('normal')
    setDueDate('')
    setAssigneeIds([])
    setIsSaving(false)
  }

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) =>
      current.includes(memberId)
        ? current.filter((candidate) => candidate !== memberId)
        : [...current, memberId],
    )
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
        <div className="assignee-picker">
          <span>Assignees</span>
          {teamMembers.length ? (
            <div className="assignee-options">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={assigneeIds.includes(member.id) ? 'assignee-option selected' : 'assignee-option'}
                  onClick={() => toggleAssignee(member.id)}
                  disabled={disabled || isSaving}
                >
                  <Avatar member={member} size="sm" />
                  {member.name}
                </button>
              ))}
            </div>
          ) : (
            <p>Add team members below to assign work.</p>
          )}
        </div>
        <button type="submit" disabled={disabled || isSaving || !title.trim()}>
          {isSaving || isBooting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Add task
        </button>
      </div>
    </form>
  )
}

function TeamPanel({
  disabled,
  isLoading,
  teamMembers,
  onCreate,
}: {
  disabled: boolean
  isLoading: boolean
  teamMembers: TeamMember[]
  onCreate: (input: NewTeamMemberInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [color, setColor] = useState(memberColors[0])
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) {
      return
    }

    setIsSaving(true)
    await onCreate({ name, avatarUrl, color })
    setName('')
    setAvatarUrl('')
    setColor(memberColors[0])
    setIsSaving(false)
  }

  return (
    <section className="team-panel" aria-labelledby="team-title">
      <div className="team-heading">
        <div>
          <span className="team-icon">
            <Users size={18} />
          </span>
          <div>
            <h2 id="team-title">Team Members</h2>
            <p>Create a small team and assign people to tasks.</p>
          </div>
        </div>
        <div className="team-roster" aria-label="Current team members">
          {isLoading ? (
            <span className="team-loading">Loading team...</span>
          ) : teamMembers.length ? (
            teamMembers.map((member) => <Avatar key={member.id} member={member} />)
          ) : (
            <span className="team-loading">No members yet</span>
          )}
        </div>
      </div>

      <form className="member-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            placeholder="Avery Brooks"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={disabled || isSaving}
          />
        </label>
        <label>
          Avatar URL
          <input
            placeholder="Optional image URL"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            disabled={disabled || isSaving}
          />
        </label>
        <label>
          Color
          <div className="color-row">
            {memberColors.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === color ? 'color-swatch selected' : 'color-swatch'}
                style={{ background: candidate }}
                aria-label={`Use ${candidate} as member color`}
                onClick={() => setColor(candidate)}
                disabled={disabled || isSaving}
              />
            ))}
          </div>
        </label>
        <button type="submit" disabled={disabled || isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
          Add member
        </button>
      </form>
    </section>
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

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="task-stack">
          {isLoading ? (
            <LoadingCards />
          ) : tasks.length ? (
            tasks.map((task) => <SortableTaskCard key={task.id} task={task} />)
          ) : (
            <EmptyState status={column.id} />
          )}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
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
        <AssigneeStack assignees={task.assignees} />
      </footer>
    </article>
  )
}

function AssigneeStack({ assignees }: { assignees: TeamMember[] }) {
  if (!assignees.length) {
    return <span className="unassigned">Unassigned</span>
  }

  return (
    <div className="assignee-stack" aria-label={assignees.map((member) => member.name).join(', ')}>
      {assignees.slice(0, 3).map((member) => (
        <Avatar key={member.id} member={member} size="sm" />
      ))}
      {assignees.length > 3 ? <span className="avatar-more">+{assignees.length - 3}</span> : null}
    </div>
  )
}

function Avatar({ member, size = 'md' }: { member: TeamMember; size?: 'sm' | 'md' }) {
  const initials = member.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return member.avatar_url ? (
    <img
      className={`avatar ${size}`}
      src={member.avatar_url}
      alt={member.name}
      style={{ borderColor: member.color }}
    />
  ) : (
    <span className={`avatar ${size}`} style={{ background: member.color }}>
      {initials}
    </span>
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
