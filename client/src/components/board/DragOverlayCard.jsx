import TaskCard from './TaskCard'

export default function DragOverlayCard({ task }) {
  if (!task) return null
  return (
    <div className="rotate-[1.5deg] scale-[1.02]" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
      <TaskCard task={task} overlay />
    </div>
  )
}
