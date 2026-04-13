import { createContext, useReducer, useEffect, useCallback } from 'react'
import * as tasksApi from '../api/tasks.api'

export const TaskContext = createContext(null)

const initialState = {
  tasks: [],
  loading: true,
  error: null,
  activeId: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null }

    case 'FETCH_SUCCESS':
      return { ...state, loading: false, tasks: action.payload }

    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload }

    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] }

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
      }

    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) }

    case 'REORDER_TASKS':
      return { ...state, tasks: action.payload }

    case 'SET_ACTIVE_ID':
      return { ...state, activeId: action.payload }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

    default:
      return state
  }
}

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadTasks = useCallback(async () => {
    dispatch({ type: 'FETCH_START' })
    try {
      const tasks = await tasksApi.fetchTasks()
      dispatch({ type: 'FETCH_SUCCESS', payload: tasks })
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: err.response?.data?.error || 'Failed to load tasks' })
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const addTask = useCallback(async (data) => {
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      title: data.title,
      description: data.description || null,
      status: data.status || 'TODO',
      priority: data.priority || 'MEDIUM',
      tag: data.tag || null,
      position: 9999,
      dueDate: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_TASK', payload: optimistic })
    try {
      const created = await tasksApi.createTask(data)
      // Replace optimistic entry with real server response via a targeted update
      dispatch({ type: 'DELETE_TASK', payload: optimistic.id })
      dispatch({ type: 'ADD_TASK', payload: created })
      return created
    } catch (err) {
      dispatch({ type: 'DELETE_TASK', payload: optimistic.id })
      dispatch({ type: 'FETCH_ERROR', payload: 'Failed to create task' })
    }
  }, [])

  const editTask = useCallback(async (id, data) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id, ...data } })
    try {
      const updated = await tasksApi.updateTask(id, data)
      dispatch({ type: 'UPDATE_TASK', payload: updated })
      return updated
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: 'Failed to update task' })
    }
  }, [])

  const removeTask = useCallback(async (id) => {
    dispatch({ type: 'DELETE_TASK', payload: id })
    try {
      await tasksApi.deleteTask(id)
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: 'Failed to delete task' })
    }
  }, [])

  const reorder = useCallback(async (newTasks, updates) => {
    dispatch({ type: 'REORDER_TASKS', payload: newTasks })
    try {
      await tasksApi.reorderTasks(updates)
    } catch (err) {
      console.error('Reorder failed silently:', err)
    }
  }, [])

  const setActiveId = useCallback((id) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: id })
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  return (
    <TaskContext.Provider value={{
      ...state,
      loadTasks,
      addTask,
      editTask,
      removeTask,
      reorder,
      setActiveId,
      clearError,
    }}>
      {children}
    </TaskContext.Provider>
  )
}
