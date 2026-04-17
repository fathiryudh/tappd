import axiosClient from './axiosClient'
import { unwrapResponse } from '../lib/http'

/**
 * @typedef {import('../../../shared/contracts/api').Officer} Officer
 * @typedef {import('../../../shared/contracts/api').OfficerFormOptions} OfficerFormOptions
 * @typedef {import('../../../shared/contracts/api').OfficerWritePayload} OfficerWritePayload
 */

/**
 * @param {{ divisionId?: string, branchId?: string }} [params]
 * @returns {Promise<Officer[]>}
 */
export const fetchOfficers = (params = {}) => {
  const query = new URLSearchParams()
  if (params.divisionId) query.set('divisionId', params.divisionId)
  if (params.branchId) query.set('branchId', params.branchId)
  const qs = query.toString()
  return axiosClient.get(`/officers${qs ? `?${qs}` : ''}`).then(unwrapResponse)
}

/**
 * @returns {Promise<OfficerFormOptions>}
 */
export const fetchOfficerFormOptions = () => axiosClient.get('/officers/form-options').then(unwrapResponse)

/**
 * @param {OfficerWritePayload} data
 * @returns {Promise<Officer>}
 */
export const addOfficer = (data) => axiosClient.post('/officers', data).then(unwrapResponse)
export const deleteOfficer = (id) => axiosClient.delete(`/officers/${id}`)
