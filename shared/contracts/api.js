/**
 * @typedef {Object} NamedRelation
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} AvailabilityRecord
 * @property {string} id
 * @property {string} officerId
 * @property {Date | string} date
 * @property {string} status
 * @property {string | null | undefined} [reason]
 * @property {string} rawMessage
 * @property {string | null | undefined} [notes]
 * @property {boolean} splitDay
 * @property {Date | string} createdAt
 */

/**
 * @typedef {Object} Officer
 * @property {string} id
 * @property {string | null} telegramId
 * @property {string | null} telegramName
 * @property {string} phoneNumber
 * @property {string | null} name
 * @property {string | null} rank
 * @property {string} role
 * @property {string | null} divisionId
 * @property {NamedRelation | null} division
 * @property {string | null} branchId
 * @property {NamedRelation | null} branch
 * @property {string | null} adminId
 * @property {AvailabilityRecord[]} availability
 * @property {Date | string} createdAt
 * @property {Date | string} updatedAt
 */

/**
 * @typedef {Object} OfficerWritePayload
 * @property {string} [phoneNumber]
 * @property {string} [name]
 * @property {string} [rank]
 * @property {string} [role]
 * @property {string} [divisionId]
 * @property {string} [division]
 * @property {string} [branchId]
 * @property {string} [branch]
 */

/**
 * @typedef {Object} OfficerFormOptions
 * @property {NamedRelation[]} divisions
 */

/**
 * @typedef {Object} NotificationEvent
 * @property {string} id
 * @property {string} adminId
 * @property {string} officerId
 * @property {string} title
 * @property {string} message
 * @property {Date | string} eventDate
 * @property {Date | string | null} readAt
 * @property {Date | string} createdAt
 * @property {Officer | null} officer
 */

/**
 * @typedef {Object} NotificationsPayload
 * @property {NotificationEvent[]} items
 * @property {number} unreadCount
 */

/**
 * @typedef {Object} ApiSuccessResponse
 * @property {true} ok
 */

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 */

/**
 * @typedef {Object} LogoutResponse
 * @property {string} message
 */

const OFFICER_ROLES = Object.freeze({
  OFFICER: 'OFFICER',
  NSF: 'NSF',
})

const AVAILABILITY_STATUSES = Object.freeze({
  IN: 'IN',
  OUT: 'OUT',
})

const DEFAULT_NOTIFICATION_LIMIT = 12
const MAX_NOTIFICATION_LIMIT = 50

const OFFICER_RELATION_INCLUDE = Object.freeze({
  division: true,
  branch: true,
})

const OFFICER_FORM_OPTION_SELECT = Object.freeze({
  id: true,
  name: true,
})

function buildOfficerInclude({ date } = {}) {
  return {
    ...OFFICER_RELATION_INCLUDE,
    ...(date
      ? {
          availability: {
            where: { date },
            take: 1,
          },
        }
      : {}),
  }
}

function serializeNamedRelation(record) {
  if (!record) return null

  return {
    id: record.id,
    name: record.name,
  }
}

function serializeOfficer(officer) {
  return {
    id: officer.id,
    ...('telegramId' in officer ? { telegramId: officer.telegramId ?? null } : {}),
    ...('telegramName' in officer ? { telegramName: officer.telegramName ?? null } : {}),
    ...('phoneNumber' in officer ? { phoneNumber: officer.phoneNumber } : {}),
    ...('name' in officer ? { name: officer.name ?? null } : {}),
    ...('rank' in officer ? { rank: officer.rank ?? null } : {}),
    ...('role' in officer ? { role: officer.role } : {}),
    ...('divisionId' in officer ? { divisionId: officer.divisionId ?? null } : {}),
    ...('division' in officer ? { division: serializeNamedRelation(officer.division) } : {}),
    ...('branchId' in officer ? { branchId: officer.branchId ?? null } : {}),
    ...('branch' in officer ? { branch: serializeNamedRelation(officer.branch) } : {}),
    ...('adminId' in officer ? { adminId: officer.adminId ?? null } : {}),
    ...('availability' in officer ? { availability: officer.availability ?? [] } : {}),
    ...('createdAt' in officer ? { createdAt: officer.createdAt } : {}),
    ...('updatedAt' in officer ? { updatedAt: officer.updatedAt } : {}),
  }
}

function serializeOfficerCollection(officers) {
  return officers.map(serializeOfficer)
}

function serializeFormOptions({ divisions = [] } = {}) {
  return {
    divisions: divisions.map(serializeNamedRelation),
  }
}

function serializeNotificationEvent(item) {
  return {
    id: item.id,
    adminId: item.adminId,
    officerId: item.officerId,
    title: item.title,
    message: item.message,
    eventDate: item.eventDate,
    readAt: item.readAt ?? null,
    createdAt: item.createdAt,
    officer: item.officer ? serializeOfficer(item.officer) : null,
  }
}

function serializeNotificationsPayload({ items = [], unreadCount = 0 } = {}) {
  return {
    items: items.map(serializeNotificationEvent),
    unreadCount,
  }
}

function serializeAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
  }
}

function serializeSuccessResponse() {
  return { ok: true }
}

function serializeLogoutResponse() {
  return { message: 'Logged out' }
}

module.exports = {
  AVAILABILITY_STATUSES,
  DEFAULT_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_LIMIT,
  OFFICER_FORM_OPTION_SELECT,
  OFFICER_RELATION_INCLUDE,
  OFFICER_ROLES,
  buildOfficerInclude,
  serializeAuthUser,
  serializeFormOptions,
  serializeLogoutResponse,
  serializeNamedRelation,
  serializeNotificationsPayload,
  serializeOfficer,
  serializeOfficerCollection,
  serializeSuccessResponse,
}
