import axiosClient from './axiosClient'
import { unwrapResponse } from '../lib/http'

/**
 * @typedef {import('../../../shared/contracts/api').Officer} Officer
 * @typedef {import('../../../shared/contracts/api').OfficerFormOptions} OfficerFormOptions
 * @typedef {import('../../../shared/contracts/api').OfficerWritePayload} OfficerWritePayload
 */

/**
 * @returns {Promise<Officer[]>}
 */
export const fetchOfficers = () => axiosClient.get('/officers').then(unwrapResponse)

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
