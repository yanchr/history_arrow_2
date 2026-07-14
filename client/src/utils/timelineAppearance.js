export const TIMELINE_BG_STORAGE_KEY = 'history-arrow-timeline-bg-color'
export const TIMELINE_CUSTOM_BG_VAR = '--timeline-custom-bg'
export const DEFAULT_TIMELINE_BG_COLOR = '#141425'

export const normalizeHexColor = (value) => {
  const trimmed = String(value || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const hex = trimmed.slice(1)
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase()
  }
  return null
}

export const loadTimelineBackgroundColor = () => {
  try {
    const stored = sessionStorage.getItem(TIMELINE_BG_STORAGE_KEY)
    if (!stored) return null
    return normalizeHexColor(stored)
  } catch {
    return null
  }
}

export const syncTimelineBackgroundCssVar = (color) => {
  if (typeof document === 'undefined') return

  if (color) {
    document.documentElement.style.setProperty(TIMELINE_CUSTOM_BG_VAR, color)
  } else {
    document.documentElement.style.removeProperty(TIMELINE_CUSTOM_BG_VAR)
  }
}

export const persistTimelineBackgroundColor = (color) => {
  if (color) {
    sessionStorage.setItem(TIMELINE_BG_STORAGE_KEY, color)
  } else {
    sessionStorage.removeItem(TIMELINE_BG_STORAGE_KEY)
  }
  syncTimelineBackgroundCssVar(color)
}

if (typeof document !== 'undefined') {
  syncTimelineBackgroundCssVar(loadTimelineBackgroundColor())
}
