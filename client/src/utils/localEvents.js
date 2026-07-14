const STORAGE_KEY = 'history-arrow-local-events'

export function isLocalEventId(id) {
  return typeof id === 'string' && id.startsWith('local-')
}

export function isLocalEvent(event) {
  return Boolean(event?.is_local || isLocalEventId(event?.id))
}

export function loadLocalEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

function newLocalId() {
  return `local-${crypto.randomUUID()}`
}

export function createLocalEvent(eventData) {
  const events = loadLocalEvents()
  const now = new Date().toISOString()
  const newEvent = {
    ...eventData,
    id: newLocalId(),
    is_local: true,
    created_at: now,
    updated_at: now
  }
  const next = [...events, newEvent]
  saveLocalEvents(next)
  return newEvent
}

export function updateLocalEvent(id, eventData) {
  const events = loadLocalEvents()
  const index = events.findIndex((e) => e.id === id)
  if (index === -1) {
    throw new Error('Local event not found')
  }
  const updated = {
    ...events[index],
    ...eventData,
    id,
    is_local: true,
    updated_at: new Date().toISOString()
  }
  const next = [...events]
  next[index] = updated
  saveLocalEvents(next)
  return updated
}

export function deleteLocalEvent(id) {
  const events = loadLocalEvents()
  const idsToRemove = new Set([id])

  // Cascade delete children (and nested children) by parent_id
  let changed = true
  while (changed) {
    changed = false
    for (const event of events) {
      if (event.parent_id && idsToRemove.has(event.parent_id) && !idsToRemove.has(event.id)) {
        idsToRemove.add(event.id)
        changed = true
      }
    }
  }

  const next = events.filter((e) => !idsToRemove.has(e.id))
  saveLocalEvents(next)
}

export function clearLocalEvents() {
  saveLocalEvents([])
}

/** Fields safe to insert into Supabase (no local-only metadata). */
export function toRemoteEventPayload(event, parentIdOverride) {
  return {
    title: event.title,
    description: event.description,
    image_url: event.image_url ?? null,
    source_url: event.source_url ?? null,
    youtube_url: event.youtube_url ?? null,
    attribution_text: event.attribution_text ?? null,
    is_published: Boolean(event.is_published),
    license_type: event.license_type ?? null,
    date_type: event.date_type,
    start_date: event.start_date ?? null,
    end_date: event.end_date ?? null,
    astronomical_start_year: event.astronomical_start_year ?? null,
    astronomical_end_year: event.astronomical_end_year ?? null,
    label: event.label ?? null,
    parent_id: parentIdOverride !== undefined ? parentIdOverride : (event.parent_id ?? null)
  }
}
