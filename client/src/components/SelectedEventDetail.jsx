import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatEventDate } from '../utils/dateUtils'
import { eventToYearsAgo } from '../utils/logScaleUtils'
import { canViewEventContent, getRestrictedContentMessage } from '../utils/contentVisibility'
import { getSubEventsForParent } from '../utils/eventHierarchy'
import './SelectedEventDetail.css'

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const URL_REGEX = /(https?:\/\/[^\s]+)/g
const HTML_LINK_REGEX = /<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi

function decodeHtmlEntities(value) {
  if (!value) return ''
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
}

function normalizeAttributionUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('/')) return `https://commons.wikimedia.org${trimmed}`
  return null
}

function getSourceLabel(url) {
  if (!url) return 'Source link'
  if (url.includes('commons.wikimedia.org')) return 'Wikimedia Commons'

  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    return host || 'Source link'
  } catch {
    return 'Source link'
  }
}

function normalizeExternalUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function extractYouTubeVideoId(rawUrl) {
  const normalizedUrl = normalizeExternalUrl(rawUrl)
  if (!normalizedUrl) return null

  try {
    const parsed = new URL(normalizedUrl)
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()

    let videoId = null
    if (host === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0]
    } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v')
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2]
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2]
      } else if (parsed.pathname.startsWith('/live/')) {
        videoId = parsed.pathname.split('/')[2]
      }
    }

    if (!videoId) return null
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null
  } catch {
    return null
  }
}

function normalizeAttributionInput(rawText) {
  const withMarkdownLinks = rawText.replace(HTML_LINK_REGEX, (_match, href, label) => {
    const normalizedUrl = normalizeAttributionUrl(decodeHtmlEntities(href))
    const cleanLabel = decodeHtmlEntities(label.replace(/<[^>]+>/g, '')).trim()
    if (!normalizedUrl) return cleanLabel
    return `[${cleanLabel}](${normalizedUrl})`
  })

  const withoutHtmlTags = withMarkdownLinks.replace(/<[^>]+>/g, ' ')
  return decodeHtmlEntities(withoutHtmlTags).replace(/\s+/g, ' ').trim()
}

function renderAttributionText(text) {
  const normalizedText = normalizeAttributionInput(text)
  const blocks = []
  let lastIndex = 0
  let match
  MARKDOWN_LINK_REGEX.lastIndex = 0

  while ((match = MARKDOWN_LINK_REGEX.exec(normalizedText)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', value: normalizedText.slice(lastIndex, match.index) })
    }
    blocks.push({ type: 'link', label: match[1], url: match[2] })
    lastIndex = MARKDOWN_LINK_REGEX.lastIndex
  }

  if (lastIndex < normalizedText.length) {
    blocks.push({ type: 'text', value: normalizedText.slice(lastIndex) })
  }

  const normalized = blocks.length > 0 ? blocks : [{ type: 'text', value: normalizedText }]
  const output = []
  let key = 0

  normalized.forEach((block) => {
    if (block.type === 'link') {
      output.push(
        <a
          key={`link-${key++}`}
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="selected-event-attribution-link"
        >
          {block.label}
        </a>
      )
      return
    }

    const textParts = block.value.split(URL_REGEX)
    textParts.forEach((part) => {
      if (!part) return
      if (/^https?:\/\//i.test(part)) {
        output.push(
          <a
            key={`url-${key++}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="selected-event-attribution-link"
          >
            {part}
          </a>
        )
      } else {
        output.push(<span key={`text-${key++}`}>{part}</span>)
      }
    })
  })

  return output
}

function formatIsoDateToDotted(dateString) {
  if (!dateString || typeof dateString !== 'string') return null
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return `${match[3]}.${match[2]}.${match[1]}`
}

function formatAgeFromYears(years) {
  if (!Number.isFinite(years) || years < 0) return null
  if (years >= 1e9) return `${(years / 1e9).toFixed(2).replace(/\.?0+$/, '')} billion years`
  if (years >= 1e6) return `${(years / 1e6).toFixed(1).replace(/\.?0+$/, '')} million years`
  if (years >= 1e3) return `${(years / 1e3).toFixed(1).replace(/\.?0+$/, '')} thousand years`
  if (years >= 10) return `${Math.round(years)} years`
  return `${years.toFixed(1).replace(/\.?0+$/, '')} years`
}

function getSubEventAgeMeta(parentEvent, subEvent) {
  if (!parentEvent || !subEvent || parentEvent.date_type !== subEvent.date_type) return null

  if (subEvent.date_type === 'astronomical') {
    const parentStart = Number(parentEvent.astronomical_start_year)
    const subStart = Number(subEvent.astronomical_start_year)
    if (!Number.isFinite(parentStart) || !Number.isFinite(subStart)) return null
    const ageYears = Math.max(0, parentStart - subStart)
    const ageLabel = formatAgeFromYears(ageYears)
    const atLabel = formatEventDate(subEvent, false)
    if (!ageLabel || !atLabel) return null
    return `age: ${ageLabel} | ${atLabel}`
  }

  const parentStart = new Date(parentEvent.start_date)
  const subStart = new Date(subEvent.start_date)
  if (Number.isNaN(parentStart.getTime()) || Number.isNaN(subStart.getTime())) return null
  const diffYears = Math.max(0, (subStart.getTime() - parentStart.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  const ageLabel = formatAgeFromYears(diffYears)
  const atLabel = formatIsoDateToDotted(subEvent.start_date) || formatEventDate(subEvent, false)
  if (!ageLabel || !atLabel) return null
  return `age: ${ageLabel} | ${atLabel}`
}

function SelectedEventDetail({
  event,
  onClose,
  onEdit,
  isAdmin = false,
  allEvents = [],
  labelColor = null
}) {
  const [isImageZoomed, setIsImageZoomed] = useState(false)

  useEffect(() => {
    setIsImageZoomed(false)
  }, [event?.id])

  useEffect(() => {
    if (!isImageZoomed) return undefined

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsImageZoomed(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isImageZoomed])

  if (!event) return null

  const {
    title,
    description,
    image_url,
    source_url,
    youtube_url,
    attribution_text,
    license_type,
    is_published,
    date_type
  } = event

  // Get formatted dates based on event type
  const startDateDisplay = formatEventDate(event, false)
  const endDateDisplay = formatEventDate(event, true)

  // Determine if this is a span based on the event type
  const isSpan = date_type === 'astronomical'
    ? !!event.astronomical_end_year
    : !!event.end_date

  const subEvents = useMemo(() => {
    if (!event?.id || !Array.isArray(allEvents) || allEvents.length === 0) return []
    return getSubEventsForParent(allEvents, event.id).filter((s) => canViewEventContent(s, isAdmin))
  }, [event?.id, allEvents, isAdmin])

  const subTimelineAccent = labelColor || '#22c55e'

  // Get event type label
  const eventTypeLabel = date_type === 'astronomical' ? 'Astronomical' : 'Historical'
  const canViewProtectedContent = canViewEventContent(event, isAdmin)
  const rawSourceUrl = source_url || event.event_url
  const sourceUrlHref = rawSourceUrl
    ? (/^https?:\/\//i.test(rawSourceUrl) ? rawSourceUrl : `https://${rawSourceUrl}`)
    : null
  const sourceLabel = getSourceLabel(sourceUrlHref)
  const youtubeVideoId = extractYouTubeVideoId(youtube_url)
  const youtubeUrlHref = normalizeExternalUrl(youtube_url)
  const youtubeEmbedUrl = youtubeVideoId
    ? `https://www.youtube-nocookie.com/embed/${youtubeVideoId}`
    : null

  return (
    <motion.div
      className="selected-event-detail"
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="selected-event-content">
        <div className="selected-event-header">
          <div className="selected-event-badges">
            <span className={`event-badge ${date_type === 'astronomical' ? 'astronomical' : 'historical'}`}>
              {eventTypeLabel}
            </span>
            <span className={`event-badge ${isSpan ? 'span' : 'point'}`}>
              {isSpan ? 'Time Span' : 'Point Event'}
            </span>
            {isAdmin && !is_published && (
              <span className="event-badge unpublished">Unpublished (admin-visible only)</span>
            )}
          </div>
          <div className="selected-event-actions">
            {onEdit && (
              <button className="edit-btn" onClick={() => onEdit(event)} aria-label="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <h2 className="selected-event-title">{title}</h2>

        {canViewProtectedContent && image_url && (
          <div className="selected-event-image-wrapper">
            <img
              src={image_url}
              alt={title}
              className="selected-event-image"
              onClick={() => setIsImageZoomed(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setIsImageZoomed(true)
                }
              }}
              aria-label={`Enlarge image for ${title}`}
            />
          </div>
        )}

        <div className="selected-event-dates">
          {isSpan && endDateDisplay ? (
            <>
              <span className="date-value">{startDateDisplay}</span>
              <span className="date-separator">→</span>
              <span className="date-value">{endDateDisplay}</span>
            </>
          ) : (
            <span className="date-value">{startDateDisplay}</span>
          )}
        </div>

        {!canViewProtectedContent && (
          <p className="selected-event-note">{getRestrictedContentMessage()}</p>
        )}

        {canViewProtectedContent && description && (
          <p className="selected-event-description">{description}</p>
        )}

        {canViewProtectedContent && isSpan && subEvents.length > 0 && (
          <div
            className="selected-event-sub-timeline"
            style={{ '--sub-event-accent': subTimelineAccent }}
          >
            {subEvents.map((sub) => {
              const canViewSub = canViewEventContent(sub, isAdmin)
              const subAgeMeta = getSubEventAgeMeta(event, sub)
              const subYearsAgo = eventToYearsAgo(sub)
              const subYoutubeVideoId = extractYouTubeVideoId(sub.youtube_url)
              const subYoutubeUrlHref = normalizeExternalUrl(sub.youtube_url)
              const subYoutubeEmbedUrl = subYoutubeVideoId
                ? `https://www.youtube-nocookie.com/embed/${subYoutubeVideoId}`
                : null
              return (
                <div key={sub.id} className="selected-event-sub-row">
                  <div className="selected-event-sub-track">
                    <div className="selected-event-sub-axis" />
                    <span className="selected-event-sub-connector" />
                  </div>
                  <div className="selected-event-sub-body">
                    <p className="selected-event-sub-title">
                      {sub.title}
                      {subAgeMeta && (
                        <span className="selected-event-sub-meta"> - {subAgeMeta}</span>
                      )}
                      {!subAgeMeta && Number.isFinite(subYearsAgo) && (
                        <span className="selected-event-sub-meta"> - {formatEventDate(sub, false)}</span>
                      )}
                    </p>
                    {canViewSub && sub.description && (
                      <p className="selected-event-sub-text">{sub.description}</p>
                    )}
                    {canViewSub && sub.image_url && (
                      <div className="selected-event-sub-image-wrap">
                        <img src={sub.image_url} alt={sub.title} className="selected-event-sub-image" />
                        {(sub.attribution_text || sub.license_type) && (
                          <p className="selected-event-sub-image-credit">
                            <span className="selected-event-sub-image-credit-title">Image credit:</span>{' '}
                            {sub.attribution_text ? renderAttributionText(sub.attribution_text) : 'Unknown'}
                            {sub.license_type ? ` - ${sub.license_type}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                    {canViewSub && subYoutubeEmbedUrl && (
                      <div className="selected-event-sub-video">
                        <iframe
                          src={subYoutubeEmbedUrl}
                          title={`${sub.title} video`}
                          className="selected-event-sub-video-frame"
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {canViewSub && !subYoutubeEmbedUrl && subYoutubeUrlHref && (
                      <a
                        className="selected-event-sub-link"
                        href={subYoutubeUrlHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Watch on YouTube
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {canViewProtectedContent && youtubeEmbedUrl && (
          <div className="selected-event-video">
            <iframe
              src={youtubeEmbedUrl}
              title={`${title} video`}
              className="selected-event-video-frame"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )}

        {canViewProtectedContent && !youtubeEmbedUrl && youtubeUrlHref && (
          <a
            className="selected-event-link"
            href={youtubeUrlHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch on YouTube
          </a>
        )}

        {canViewProtectedContent && sourceUrlHref && (
          <a
            className="selected-event-link"
            href={sourceUrlHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read more
          </a>
        )}

        {canViewProtectedContent && image_url && attribution_text && (
          <div className="selected-event-attribution">
            <p className="selected-event-attribution-row">
              <span className="selected-event-attribution-title">Image credit:</span>{' '}
              {renderAttributionText(attribution_text)}
            </p>
            {sourceUrlHref && (
              <p className="selected-event-attribution-row">
                <span className="selected-event-attribution-title">Source:</span>{' '}
                <a
                  className="selected-event-attribution-link"
                  href={sourceUrlHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sourceLabel}
                </a>
                .
              </p>
            )}
            {license_type && (
              <p className="selected-event-attribution-row">
                <span className="selected-event-attribution-title">License:</span>{' '}
                <span>{license_type}</span>.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="selected-event-indicator">
        <span>Click another event to view details, or</span>
        <button className="text-btn" onClick={onClose}>dismiss</button>
      </div>

      <AnimatePresence>
        {isImageZoomed && canViewProtectedContent && image_url && (
          <motion.div
            className="selected-event-image-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsImageZoomed(false)}
          >
            <motion.div
              className="selected-event-image-zoomed-wrap"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={image_url}
                alt={title}
                className="selected-event-image-zoomed"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default SelectedEventDetail
