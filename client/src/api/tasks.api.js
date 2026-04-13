import axiosClient from './axiosClient'

export const fetchTasks = () =>
  axiosClient.get('/tasks').then(r => r.data.tasks)

export const createTask = (data) =>
  axiosClient.post('/tasks', data).then(r => r.data)

export const updateTask = (id, data) =>
  axiosClient.patch(`/tasks/${id}`, data).then(r => r.data)

export const deleteTask = (id) =>
  axiosClient.delete(`/tasks/${id}`)

export const reorderTasks = (updates) =>
  axiosClient.patch('/tasks/reorder', { updates })
