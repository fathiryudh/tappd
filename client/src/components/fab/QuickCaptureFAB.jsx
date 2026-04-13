import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, ArrowRight } from '@phosphor-icons/react'
import { useTasks } from '../../hooks/useTasks'

export default function QuickCaptureFAB() {
  const { addTask } = useTasks()
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [success, setSuccess] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleOpen = () => setIsOpen(true)
  const handleClose = () => { setIsOpen(false); setValue('') }

  const handleSubmit = async () => {
    const title = value.trim()
    if (!title) { handleClose(); return }
    setValue('')
    setIsOpen(false)
    setSuccess(true)
    await addTask({ title })
    setTimeout(() => setSuccess(false), 600)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') handleClose()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center justify-end">
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`flex items-center overflow-hidden ${
          isOpen
            ? 'rounded-2xl bg-zinc-900 border border-zinc-700/80 w-72'
            : `rounded-full ${success ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'} w-12`
        }`}
        style={{ height: 48, boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 4px 20px rgba(37,99,235,0.4)' }}
      >
        {isOpen ? (
          <div className="flex items-center gap-2 px-3 w-full">
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New task..."
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none py-3"
            />
            <div className="flex items-center gap-1 shrink-0">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSubmit}
                className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-colors duration-150 cursor-pointer"
              >
                <ArrowRight size={13} weight="bold" className="text-white" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition-colors duration-150 cursor-pointer"
              >
                <X size={13} weight="bold" className="text-zinc-600" />
              </motion.button>
            </div>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleOpen}
            className="w-12 h-12 flex items-center justify-center cursor-pointer"
            aria-label="Quick capture task"
          >
            <motion.div
              animate={{ rotate: isOpen ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <Plus size={20} weight="bold" className="text-white" />
            </motion.div>
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
