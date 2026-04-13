import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { useTasks } from '../../hooks/useTasks'
import KanbanColumn from './KanbanColumn'
import DragOverlayCard from './DragOverlayCard'

const COLUMNS = ['TODO', 'IN_PROGRESS', 'YAPPD']

function getColumnTasks(tasks, status) {
  return tasks
    .filter(t => t.status === status)
    .sort((a, b) => a.position - b.position)
}

export default function KanbanBoard() {
  const { tasks, activeId, setActiveId, reorder } = useTasks()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const findColumn = (id) => {
    if (COLUMNS.includes(id)) return id
    return tasks.find(t => t.id === id)?.status ?? null
  }

  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
  }

  const handleDragOver = ({ active, over }) => {
    if (!over) return
    const activeCol = findColumn(active.id)
    const overCol = findColumn(over.id)
    if (!activeCol || !overCol || activeCol === overCol) return

    const newTasks = tasks.map(t =>
      t.id === active.id ? { ...t, status: overCol } : t
    )
    reorder(newTasks, [])
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeCol = findColumn(active.id)
    const overCol = findColumn(over.id)
    if (!activeCol || !overCol) return

    const colTasks = getColumnTasks(tasks, overCol)
    const oldIndex = colTasks.findIndex(t => t.id === active.id)
    const newIndex = colTasks.findIndex(t => t.id === over.id)

    let reordered
    if (activeCol === overCol) {
      reordered = arrayMove(colTasks, oldIndex === -1 ? colTasks.length - 1 : oldIndex, newIndex === -1 ? colTasks.length - 1 : newIndex)
    } else {
      const targetIndex = newIndex === -1 ? colTasks.length : newIndex
      const withMoved = colTasks.filter(t => t.id !== active.id)
      const activeTask = tasks.find(t => t.id === active.id)
      withMoved.splice(targetIndex, 0, { ...activeTask, status: overCol })
      reordered = withMoved
    }

    const updatedColTasks = reordered.map((t, i) => ({ ...t, position: i }))
    const updates = updatedColTasks.map(t => ({ id: t.id, status: t.status, position: t.position }))

    const newTaskList = tasks.map(t => {
      const updated = updatedColTasks.find(u => u.id === t.id)
      return updated ?? t
    })

    reorder(newTaskList, updates)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start gap-0">
        {/* TODO + IN_PROGRESS with gap-6 */}
        <div className="flex items-start gap-6">
          <KanbanColumn status="TODO" tasks={getColumnTasks(tasks, 'TODO')} />
          <KanbanColumn status="IN_PROGRESS" tasks={getColumnTasks(tasks, 'IN_PROGRESS')} />
        </div>
        {/* YAPPD pulled slightly closer — gap-4 */}
        <div className="flex items-start gap-4 ml-4">
          <KanbanColumn status="YAPPD" tasks={getColumnTasks(tasks, 'YAPPD')} />
        </div>
      </div>

      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <DragOverlayCard task={activeTask} />
      </DragOverlay>
    </DndContext>
  )
}
