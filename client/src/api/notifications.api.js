import axiosClient from './axiosClient'
import { unwrapResponse } from '../lib/http'

/**
 * @typedef {import('../../../shared/contracts/api').NotificationsPayload} NotificationsPayload
 * @typedef {import('../../../shared/contracts/api').ApiSuccessResponse} ApiSuccessResponse
 */

/**
 * @param {number} [limit=12]
 * @returns {Promise<NotificationsPayload>}
 */
export const fetchNotifications = (limit = 12) =>
  axiosClient.get('/notifications', { params: { limit } }).then(unwrapResponse)

/**
 * @returns {Promise<ApiSuccessResponse>}
 */
export const markAllNotificationsRead = () =>
  axiosClient.post('/notifications/read-all').then(unwrapResponse)
