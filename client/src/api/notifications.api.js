import axiosClient from './axiosClient'

export const fetchNotifications = (limit = 12) =>
  axiosClient.get('/notifications', { params: { limit } }).then(r => r.data)

export const markAllNotificationsRead = () =>
  axiosClient.post('/notifications/read-all').then(r => r.data)
