import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
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
  Search,
  Tag,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import { useGuestSession } from './hooks/useGuestSession'
import { useLabels } from './hooks/useLabels'
import { useTeamMembers } from './hooks/useTeamMembers'
import { useTasks } from './hooks/useTasks'
import {
  TASK_COLUMNS,
  type NewLabelInput,
  type NewTaskInput,
  type NewTeamMemberInput,
  type Task,
  type TaskLabel,
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
const labelColors = ['#2563eb', '#dc2626', '#059669', '#9333ea', '#ca8a04', '#475569']

type TaskFilters = {
  search: string
  priority: 'all' | TaskPriority
  assigneeId: 'all' | 'unassigned' | string
  labelId: 'all' | 'unlabeled' | string
}

type ActionPanel = 'task' | 'member' | 'label' | null

function createEmptyTaskGroups() {
  return TASK_COLUMNS.reduce(
    (groups, column) => ({ ...groups, [column.id]: [] }),
    {} as Record<TaskStatus, Task[]>,
  )
}

function taskMatchesFilters(task: Task, filters: TaskFilters) {
  const search = filters.search.trim().toLowerCase()
  const matchesSearch = !search || task.title.toLowerCase().includes(search)
  const matchesPriority = filters.priority === 'all' || task.priority === filters.priority
  const matchesAssignee =
    filters.assigneeId === 'all' ||
    (filters.assigneeId === 'unassigned'
      ? task.assignees.length === 0
      : task.assignees.some((member) => member.id === filters.assigneeId))
  const matchesLabel =
    filters.labelId === 'all' ||
    (filters.labelId === 'unlabeled'
      ? task.labels.length === 0
      : task.labels.some((label) => label.id === filters.labelId))

  return matchesSearch && matchesPriority && matchesAssignee && matchesLabel
}

function App() {
  const { session, isLoading: isSessionLoading, error: sessionError } = useGuestSession()
  const { tasks, isLoading, error, createTask, reorderTask, refreshTasks } = useTasks(
    session?.user.id,
  )
  const {
    teamMembers,
    isLoading: isTeamLoading,
    error: teamError,
    createTeamMember,
    refreshTeamMembers,
  } = useTeamMembers(session?.user.id)
  const {
    labels,
    isLoading: isLabelsLoading,
    error: labelsError,
    createLabel,
    refreshLabels,
  } = useLabels(session?.user.id)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeActionPanel, setActiveActionPanel] = useState<ActionPanel>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    priority: 'all',
    assigneeId: 'all',
    labelId: 'all',
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => taskMatchesFilters(task, filters))
  }, [filters, tasks])

  const filteredTasksByStatus = useMemo(() => {
    return filteredTasks.reduce(
      (groups, task) => {
        groups[task.status].push(task)
        return groups
      },
      createEmptyTaskGroups(),
    )
  }, [filteredTasks])

  const taskSummary = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'done').length
    const overdue = tasks.filter(
      (task) => task.status !== 'done' && task.due_date && isPast(parseISO(task.due_date)),
    ).length

    return {
      total: tasks.length,
      completed,
      overdue,
    }
  }, [tasks])

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

  const blockingError = sessionError || error || teamError || labelsError

  async function handleRetry() {
    await Promise.all([refreshTasks(), refreshTeamMembers(), refreshLabels()])
  }

  return (
    <main className="app-shell">
      {blockingError ? <ErrorBanner message={blockingError} onRetry={handleRetry} /> : null}

      <header className="page-header">
        <div className="page-title">
          <Calendar size={34} />
          <h1>Tasks</h1>
        </div>
      </header>

      <section className="workspace-toolbar" aria-label="Board toolbar">
        <div className="toolbar-actions">
          <button
            type="button"
            className="new-button"
            onClick={() => setActiveActionPanel((current) => (current === 'task' ? null : 'task'))}
          >
            New
            <span>⌄</span>
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() =>
              setActiveActionPanel((current) => (current === 'member' ? null : 'member'))
            }
          >
            <Users size={16} />
            Member
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => setActiveActionPanel((current) => (current === 'label' ? null : 'label'))}
          >
            <Tag size={16} />
            Label
          </button>
          <ToolbarMemberStack teamMembers={teamMembers} />
        </div>
        <SummaryTiles summary={taskSummary} />
      </section>

      <ActionModal activePanel={activeActionPanel} onClose={() => setActiveActionPanel(null)}>
        {activeActionPanel === 'task' ? (
          <TaskComposer
            disabled={!session || isSessionLoading}
            isBooting={isSessionLoading}
            teamMembers={teamMembers}
            labels={labels}
            onCreate={async (input) => {
              await createTask(input)
              setActiveActionPanel(null)
            }}
          />
        ) : null}
        {activeActionPanel === 'member' ? (
          <TeamPanel
            disabled={!session || isSessionLoading}
            isLoading={isTeamLoading}
            teamMembers={teamMembers}
            onCreate={async (input) => {
              await createTeamMember(input)
              setActiveActionPanel(null)
            }}
          />
        ) : null}
        {activeActionPanel === 'label' ? (
          <LabelPanel
            disabled={!session || isSessionLoading}
            isLoading={isLabelsLoading}
            labels={labels}
            onCreate={async (input) => {
              await createLabel(input)
              setActiveActionPanel(null)
            }}
          />
        ) : null}
      </ActionModal>

      <FilterPanel
        filters={filters}
        labels={labels}
        teamMembers={teamMembers}
        visibleCount={filteredTasks.length}
        totalCount={tasks.length}
        isOpen={isFilterOpen}
        onToggle={() => setIsFilterOpen((current) => !current)}
        onChange={setFilters}
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
              tasks={filteredTasksByStatus[column.id]}
            />
          ))}
        </section>

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} isOverlay /> : null}</DragOverlay>
      </DndContext>
    </main>
  )
}

function ToolbarMemberStack({ teamMembers }: { teamMembers: TeamMember[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!teamMembers.length) {
    return null
  }

  const visibleMembers = isExpanded ? teamMembers : teamMembers.slice(0, 3)

  return (
    <button
      type="button"
      className={isExpanded ? 'toolbar-member-stack expanded' : 'toolbar-member-stack'}
      aria-label={isExpanded ? 'Collapse team members' : 'Show all team members'}
      aria-expanded={isExpanded}
      onClick={() => setIsExpanded((current) => !current)}
    >
      {visibleMembers.map((member) => (
        <span key={member.id} className="toolbar-member-item" title={member.name}>
          <span
            className="toolbar-member-dot"
            style={{ background: member.color }}
          >
            {member.name.charAt(0).toUpperCase()}
          </span>
          {isExpanded ? <span className="toolbar-member-name">{member.name}</span> : null}
        </span>
      ))}
    </button>
  )
}

function SummaryTiles({
  summary,
}: {
  summary: {
    total: number
    completed: number
    overdue: number
  }
}) {
  return (
    <div className="summary-tiles" aria-label="Task summary">
      <article className="summary-tile">
        <span>Total tasks</span>
        <strong>{summary.total}</strong>
      </article>
      <article className="summary-tile">
        <span>Completed</span>
        <strong>{summary.completed}</strong>
      </article>
      <article className="summary-tile summary-tile-overdue">
        <span>Overdue</span>
        <strong>{summary.overdue}</strong>
      </article>
    </div>
  )
}

function ActionModal({
  activePanel,
  children,
  onClose,
}: {
  activePanel: ActionPanel
  children: ReactNode
  onClose: () => void
}) {
  if (!activePanel) {
    return null
  }

  const title: Record<Exclude<ActionPanel, null>, string> = {
    task: 'New task',
    member: 'Add member',
    label: 'Add label',
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="action-modal-title">{title[activePanel]}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function TaskComposer({
  disabled,
  isBooting,
  teamMembers,
  labels,
  onCreate,
}: {
  disabled: boolean
  isBooting: boolean
  teamMembers: TeamMember[]
  labels: TaskLabel[]
  onCreate: (input: NewTaskInput) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSaving(true)
    await onCreate({ title, description, priority, dueDate, assigneeIds, labelIds })
    setTitle('')
    setDescription('')
    setPriority('normal')
    setDueDate('')
    setAssigneeIds([])
    setLabelIds([])
    setIsSaving(false)
  }

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) =>
      current.includes(memberId)
        ? current.filter((candidate) => candidate !== memberId)
        : [...current, memberId],
    )
  }

  function toggleLabel(labelId: string) {
    setLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((candidate) => candidate !== labelId)
        : [...current, labelId],
    )
  }

  return (
    <form className="task-composer" onSubmit={handleSubmit}>
      <div className="task-form-grid">
        <div className="composer-main">
          <label htmlFor="task-title">Task details</label>
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
          <div className="meta-row">
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
          </div>
          <div className="assignee-picker">
            <span>Select Assignees</span>
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
          <div className="label-picker">
            <span>Select Labels</span>
            {labels.length ? (
              <div className="multi-label-list" role="listbox" aria-label="Select labels" aria-multiselectable="true">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className={labelIds.includes(label.id) ? 'multi-label-row selected' : 'multi-label-row'}
                    onClick={() => toggleLabel(label.id)}
                    disabled={disabled || isSaving}
                    aria-selected={labelIds.includes(label.id)}
                  >
                    <span style={{ background: label.color }} />
                    {label.name}
                  </button>
                ))}
              </div>
            ) : (
              <p>Add labels below to tag work.</p>
            )}
          </div>
        </div>
      </div>

      <footer className="composer-footer">
        <p>{title.trim() ? 'Ready to add this task to To Do.' : 'Add a title to create a task.'}</p>
        <button className="add-task-submit" type="submit" disabled={disabled || isSaving || !title.trim()}>
          {isSaving || isBooting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Add task
        </button>
      </footer>
    </form>
  )
}

function FilterPanel({
  filters,
  labels,
  teamMembers,
  visibleCount,
  totalCount,
  isOpen,
  onToggle,
  onChange,
}: {
  filters: TaskFilters
  labels: TaskLabel[]
  teamMembers: TeamMember[]
  visibleCount: number
  totalCount: number
  isOpen: boolean
  onToggle: () => void
  onChange: (filters: TaskFilters) => void
}) {
  function updateFilter(nextFilter: Partial<TaskFilters>) {
    onChange({ ...filters, ...nextFilter })
  }

  return (
    <section className={isOpen ? 'filter-panel open' : 'filter-panel'} aria-label="Task filters">
      <div className="filter-heading">
        <button
          type="button"
          className="filter-toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="task-filter-controls"
        >
          <span>
            <Search size={16} />
            Filters
          </span>
        </button>
        {isOpen ? (
          <div className="search-field filter-header-search">
            <Search size={13} />
            <input
              type="search"
              value={filters.search}
              placeholder="Search title"
              aria-label="Search tasks by title"
              onChange={(event) => updateFilter({ search: event.target.value })}
            />
          </div>
        ) : null}
        <p>
          Showing {visibleCount} of {totalCount} tasks
        </p>
      </div>
      <div
        className="filter-collapse"
        id="task-filter-controls"
        aria-hidden={!isOpen}
      >
        <div className="filter-controls">
          <div className="filter-selects">
            <label>
              Priority
              <select
                value={filters.priority}
                onChange={(event) =>
                  updateFilter({ priority: event.target.value as TaskFilters['priority'] })
                }
                tabIndex={isOpen ? 0 : -1}
              >
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Assignee
              <select
                value={filters.assigneeId}
                onChange={(event) => updateFilter({ assigneeId: event.target.value })}
                tabIndex={isOpen ? 0 : -1}
              >
                <option value="all">All assignees</option>
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Label
              <select
                value={filters.labelId}
                onChange={(event) => updateFilter({ labelId: event.target.value })}
                tabIndex={isOpen ? 0 : -1}
              >
                <option value="all">All labels</option>
                <option value="unlabeled">Unlabeled</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>
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
        <button className="modal-primary-submit" type="submit" disabled={disabled || isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
          Add member
        </button>
      </form>
    </section>
  )
}

function LabelPanel({
  disabled,
  isLoading,
  labels,
  onCreate,
}: {
  disabled: boolean
  isLoading: boolean
  labels: TaskLabel[]
  onCreate: (input: NewLabelInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(labelColors[0])
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) {
      return
    }

    setIsSaving(true)
    await onCreate({ name, color })
    setName('')
    setColor(labelColors[0])
    setIsSaving(false)
  }

  return (
    <section className="label-panel" aria-labelledby="labels-title">
      <div className="team-heading">
        <div>
          <span className="team-icon">
            <Tag size={18} />
          </span>
          <div>
            <h2 id="labels-title">Labels</h2>
            <p>Create tags like Bug, Feature, or Design.</p>
          </div>
        </div>
        <div className="label-roster" aria-label="Current labels">
          {isLoading ? (
            <span className="team-loading">Loading labels...</span>
          ) : labels.length ? (
            labels.map((label) => <LabelPill key={label.id} label={label} />)
          ) : (
            <span className="team-loading">No labels yet</span>
          )}
        </div>
      </div>

      <form className="label-form" onSubmit={handleSubmit}>
        <label>
          Label name
          <input
            placeholder="Bug"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={disabled || isSaving}
          />
        </label>
        <label>
          Color
          <div className="color-row">
            {labelColors.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === color ? 'color-swatch selected' : 'color-swatch'}
                style={{ background: candidate }}
                aria-label={`Use ${candidate} as label color`}
                onClick={() => setColor(candidate)}
                disabled={disabled || isSaving}
              />
            ))}
          </div>
        </label>
        <button className="modal-primary-submit" type="submit" disabled={disabled || isSaving || !name.trim()}>
          {isSaving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          Add label
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
          <span className="task-count">{tasks.length}</span>
        </div>
      </header>

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
      {task.labels.length ? (
        <div className="card-labels">
          {task.labels.map((label) => (
            <LabelPill key={label.id} label={label} />
          ))}
        </div>
      ) : null}
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

function LabelPill({ label }: { label: TaskLabel }) {
  return (
    <span className="label-pill">
      <span style={{ background: label.color }} />
      {label.name}
    </span>
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
