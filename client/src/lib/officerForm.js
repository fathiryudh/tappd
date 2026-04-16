export const DEFAULT_OFFICER_FORM = Object.freeze({
  rank: '',
  name: '',
  phoneNumber: '',
  division: '',
  branch: '',
})

export function createEmptyOfficerForm() {
  return { ...DEFAULT_OFFICER_FORM }
}

export function buildOfficerPayload(form) {
  return {
    rank: form.rank.trim() || undefined,
    name: form.name.trim() || undefined,
    phoneNumber: form.phoneNumber.trim(),
    division: form.division.trim() || undefined,
    branch: form.branch.trim() || undefined,
  }
}
