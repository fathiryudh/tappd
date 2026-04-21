import axiosClient from './axiosClient'
import { unwrapResponse } from '../lib/http'

export const fetchScope = () =>
  axiosClient.get('/settings/scope').then(unwrapResponse)

export const updateScope = (data) =>
  axiosClient.put('/settings/scope', data).then(unwrapResponse)

export const fetchDigestEmails = () =>
  axiosClient.get('/settings/digest-emails').then(unwrapResponse)

export const updateDigestEmails = (digestEmails) =>
  axiosClient.put('/settings/digest-emails', { digestEmails }).then(unwrapResponse)
