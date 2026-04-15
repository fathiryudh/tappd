import axiosClient from './axiosClient'

export const fetchOfficers = () => axiosClient.get('/officers').then(r => r.data)
export const addOfficer = (data) => axiosClient.post('/officers', data).then(r => r.data)
export const updateOfficer = (id, data) => axiosClient.patch(`/officers/${id}`, data).then(r => r.data)
export const deleteOfficer = (id) => axiosClient.delete(`/officers/${id}`)
export const fetchRoster = (date) =>
  axiosClient.get('/officers/roster', { params: { date } }).then(r => r.data)
