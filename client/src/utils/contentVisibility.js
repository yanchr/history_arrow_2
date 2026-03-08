export function canViewEventContent(event, isAdmin = false) {
  return Boolean(isAdmin || event?.is_published)
}

export function getRestrictedContentMessage() {
  return 'Content temporarily hidden while rights and attribution review is in progress.'
}
