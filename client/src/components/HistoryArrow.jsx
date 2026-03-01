import { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion } from 'framer-motion'
import EventMarker from './EventMarker'
import LogarithmicMinimap from './LogarithmicMinimap'
import {
  yearToLinearPosition,
  linearPositionToYear,
  getLinearTicks,
  formatYearsAgoShort,
  eventToYearsAgo,
  eventEndToYearsAgo,
  DEFAULT_MIN_YEARS,
  DEFAULT_MAX_YEARS
} from '../utils/logScaleUtils'
import './HistoryArrow.css'

// Current date as a fractional year (e.g. 2026.14 for mid-February 2026)
const NOW = new Date()
const YEAR_START = new Date(NOW.getFullYear(), 0, 1)
const YEAR_END = new Date(NOW.getFullYear() + 1, 0, 1)
const CURRENT_YEAR = NOW.getFullYear() + (NOW - YEAR_START) / (YEAR_END - YEAR_START)
const IPHONE_MAX_WIDTH = 430
const IPHONE_MAX_SPAN_LANES = 4
const IPHONE_MAX_POINT_LANES = 5
const DESKTOP_MAX_SPAN_LANES = 10
const DESKTOP_MAX_POINT_LANES = 10
const SPAN_OVERLAP_PADDING_PERCENT = 0.35
const POINT_OVERLAP_PADDING_PERCENT = 0.25
const POINT_COLLISION_WIDTH_PERCENT = 1.6
const POINT_MARKER_WIDTH_PX = 16
const POINT_LABEL_MAX_WIDTH_PX = 120
const SPAN_LABEL_MAX_WIDTH_PX = 150
const LABEL_CHAR_WIDTH_PX = 6.4
const LABEL_PADDING_PX = 20
const DESKTOP_TIMELINE_BASE_HEIGHT = 200
const MOBILE_TIMELINE_BASE_HEIGHT = 160
const DESKTOP_SPAN_LANE_GAP = 22
const MOBILE_SPAN_LANE_GAP = 16
const DESKTOP_POINT_LANE_GAP = 28
const MOBILE_POINT_LANE_GAP = 22

const estimateLabelWidthPx = (title, maxWidthPx) => {
  const safeTitle = typeof title === 'string' ? title : ''
  const estimated = safeTitle.length * LABEL_CHAR_WIDTH_PX + LABEL_PADDING_PX
  return Math.min(maxWidthPx, Math.max(40, estimated))
}

const buildLaneLayout = (
  items,
  overlapPadding,
  isIphoneViewport,
  iphoneLaneCap,
  desktopLaneCap
) => {
  const sortedItems = [...items].sort((a, b) => {
    if (a.left !== b.left) return a.left - b.left
    if (a.width !== b.width) return b.width - a.width
    return String(a.id).localeCompare(String(b.id))
  })

  const laneRightEdges = []
  const assignments = []

  sortedItems.forEach(item => {
    let laneIndex = laneRightEdges.findIndex(
      rightEdge => item.left >= rightEdge + overlapPadding
    )

    if (laneIndex === -1) {
      laneIndex = laneRightEdges.length
      laneRightEdges.push(item.right)
    } else {
      laneRightEdges[laneIndex] = item.right
    }

    assignments.push({ id: item.id, laneIndex })
  })

  const rawLaneCount = laneRightEdges.length
  const effectiveLaneCount = rawLaneCount === 0
    ? 0
    : Math.min(rawLaneCount, isIphoneViewport ? iphoneLaneCap : desktopLaneCap)

  const laneMetadata = new Map()
  assignments.forEach(({ id, laneIndex }) => {
    const visualLane = effectiveLaneCount > 0 ? laneIndex % effectiveLaneCount : 0
    const laneRing = Math.floor(visualLane / 2) + 1
    const laneDirection = visualLane % 2 === 0 ? -1 : 1

    laneMetadata.set(id, {
      laneIndex,
      visualLane,
      laneRing,
      laneDirection,
      laneCount: rawLaneCount,
      effectiveLaneCount
    })
  })

  return {
    laneMetadata,
    rawLaneCount,
    effectiveLaneCount,
    lanesPerSide: effectiveLaneCount > 0 ? Math.ceil(effectiveLaneCount / 2) : 0
  }
}

const HistoryArrow = forwardRef(function HistoryArrow({ events, selectedEvent, onEventClick, onVisibleEventsChange, labelColorMap = new Map() }, ref) {
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [timelineHover, setTimelineHover] = useState({ active: false, x: 0, yearsAgo: 0 })
  const [isIphoneViewport, setIsIphoneViewport] = useState(false)
  const [eventsLayerWidth, setEventsLayerWidth] = useState(1000)
  // View state: years ago for the visible range
  // viewStart = closer to present (smaller years ago)
  // viewEnd = further in past (larger years ago)
  const [viewStart, setViewStart] = useState(DEFAULT_MIN_YEARS)
  const [viewEnd, setViewEnd] = useState(CURRENT_YEAR) // Default to year 0 (2026 years ago)
  const timelineRef = useRef(null)
  const eventsLayerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(`(max-width: ${IPHONE_MAX_WIDTH}px)`)
    const syncViewport = (eventOrQuery) => {
      setIsIphoneViewport(eventOrQuery.matches)
    }

    syncViewport(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport)
      return () => mediaQuery.removeEventListener('change', syncViewport)
    }

    mediaQuery.addListener(syncViewport)
    return () => mediaQuery.removeListener(syncViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!eventsLayerRef.current || typeof ResizeObserver === 'undefined') return undefined

    const updateWidth = (width) => {
      if (width > 0) {
        setEventsLayerWidth(width)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry?.contentRect?.width) {
        updateWidth(entry.contentRect.width)
      }
    })

    observer.observe(eventsLayerRef.current)
    updateWidth(eventsLayerRef.current.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({
    centerOnEvent(event) {
      const startYearsAgo = eventToYearsAgo(event)
      const endYearsAgo = eventEndToYearsAgo(event)
      const yearsAgo = endYearsAgo != null
        ? (startYearsAgo + endYearsAgo) / 2
        : startYearsAgo
      const newEnd = Math.min(yearsAgo * 2, DEFAULT_MAX_YEARS)
      setViewStart(DEFAULT_MIN_YEARS)
      setViewEnd(newEnd)
    }
  }))

  // Calculate the overall bounds from events
  const eventBounds = useMemo(() => {
    if (!events || events.length === 0) {
      return { min: DEFAULT_MIN_YEARS, max: DEFAULT_MAX_YEARS }
    }

    let minYearsAgo = Infinity
    let maxYearsAgo = 0

    events.forEach(event => {
      const startYearsAgo = eventToYearsAgo(event)
      const endYearsAgo = eventEndToYearsAgo(event)

      if (startYearsAgo < minYearsAgo) minYearsAgo = startYearsAgo
      if (startYearsAgo > maxYearsAgo) maxYearsAgo = startYearsAgo
      if (endYearsAgo !== null) {
        if (endYearsAgo < minYearsAgo) minYearsAgo = endYearsAgo
        if (endYearsAgo > maxYearsAgo) maxYearsAgo = endYearsAgo
      }
    })

    // Add padding in log space
    const logMin = Math.log10(Math.max(1, minYearsAgo))
    const logMax = Math.log10(maxYearsAgo)
    const logPadding = (logMax - logMin) * 0.05

    return {
      min: Math.max(1, Math.pow(10, logMin - logPadding)),
      max: Math.pow(10, logMax + logPadding)
    }
  }, [events])

  // Generate timeline tick marks for the current view (LINEAR for the arrow)
  const timelineTicks = useMemo(() => {
    return getLinearTicks(viewStart, viewEnd)
  }, [viewStart, viewEnd])

  // Position events on the timeline using LINEAR scale
  const positionedEvents = useMemo(() => {
    return events
      .map(event => {
        const startYearsAgo = eventToYearsAgo(event)
        const endYearsAgo = eventEndToYearsAgo(event)

        // Determine if the event is a span based on date_type and end values
        const isSpan = event.date_type === 'astronomical'
          ? !!event.astronomical_end_year
          : !!event.end_date

        return {
          ...event,
          isSpan,
          yearsAgo: startYearsAgo,
          endYearsAgo
        }
      })
      .filter(event => {
        // Filter out events completely outside the current view BEFORE positioning
        // viewStart = closest to present (smaller years ago)
        // viewEnd = furthest in past (larger years ago)
        const startYearsAgo = event.yearsAgo
        const endYearsAgo = event.endYearsAgo

        // For point events: must be within view range
        if (!event.isSpan) {
          return startYearsAgo >= viewStart && startYearsAgo <= viewEnd
        }

        // For span events: any part of the span must overlap with view range
        // Span goes from startYearsAgo (older/further in past) to endYearsAgo (newer/closer to present)
        const spanStart = Math.max(startYearsAgo, endYearsAgo || startYearsAgo)
        const spanEnd = Math.min(startYearsAgo, endYearsAgo || startYearsAgo)
        
        // Check if span overlaps with view
        return spanStart >= viewStart && spanEnd <= viewEnd
      })
      .map(event => {
        // Now calculate LINEAR positions for visible events
        const startPos = yearToLinearPosition(event.yearsAgo, viewStart, viewEnd)
        const endPos = event.endYearsAgo !== null
          ? yearToLinearPosition(event.endYearsAgo, viewStart, viewEnd)
          : null

        return {
          ...event,
          startPos,
          endPos
        }
      })
  }, [events, viewStart, viewEnd])

  const spanLaneLayout = useMemo(() => {
    const laneItems = positionedEvents
      .filter(event => event.isSpan && event.endPos !== null)
      .map(event => {
        const spanLeft = Math.min(event.startPos, event.endPos)
        const spanRight = Math.max(event.startPos, event.endPos)
        const spanCenter = (spanLeft + spanRight) / 2
        const labelWidthPx = estimateLabelWidthPx(event.title, SPAN_LABEL_MAX_WIDTH_PX)
        const labelWidthPercent = (labelWidthPx / eventsLayerWidth) * 100
        const labelLeft = spanCenter - labelWidthPercent / 2
        const labelRight = spanCenter + labelWidthPercent / 2
        const left = Math.min(spanLeft, labelLeft)
        const right = Math.max(spanRight, labelRight)

        return {
          id: event.id,
          left,
          right,
          width: right - left
        }
      })
    return buildLaneLayout(
      laneItems,
      SPAN_OVERLAP_PADDING_PERCENT,
      isIphoneViewport,
      IPHONE_MAX_SPAN_LANES,
      DESKTOP_MAX_SPAN_LANES
    )
  }, [positionedEvents, isIphoneViewport, eventsLayerWidth])

  const pointLaneLayout = useMemo(() => {
    const laneItems = positionedEvents
      .filter(event => !event.isSpan)
      .map(event => {
        const markerWidthPercent = Math.max(
          POINT_COLLISION_WIDTH_PERCENT,
          (POINT_MARKER_WIDTH_PX / eventsLayerWidth) * 100
        )
        const markerLeft = event.startPos - markerWidthPercent / 2
        const markerRight = event.startPos + markerWidthPercent / 2
        const labelWidthPx = estimateLabelWidthPx(event.title, POINT_LABEL_MAX_WIDTH_PX)
        const labelWidthPercent = (labelWidthPx / eventsLayerWidth) * 100
        const labelLeft = event.startPos - labelWidthPercent / 2
        const labelRight = event.startPos + labelWidthPercent / 2
        const left = Math.min(markerLeft, labelLeft)
        const right = Math.max(markerRight, labelRight)

        return {
          id: event.id,
          left,
          right,
          width: right - left
        }
      })

    return buildLaneLayout(
      laneItems,
      POINT_OVERLAP_PADDING_PERCENT,
      isIphoneViewport,
      IPHONE_MAX_POINT_LANES,
      DESKTOP_MAX_POINT_LANES
    )
  }, [positionedEvents, isIphoneViewport, eventsLayerWidth])

  const timelineLayoutStyle = useMemo(() => {
    const baseHeight = isIphoneViewport ? MOBILE_TIMELINE_BASE_HEIGHT : DESKTOP_TIMELINE_BASE_HEIGHT
    const spanLaneGap = isIphoneViewport ? MOBILE_SPAN_LANE_GAP : DESKTOP_SPAN_LANE_GAP
    const pointLaneGap = isIphoneViewport ? MOBILE_POINT_LANE_GAP : DESKTOP_POINT_LANE_GAP
    const laneDepthPx = Math.max(
      spanLaneLayout.lanesPerSide * spanLaneGap,
      pointLaneLayout.lanesPerSide * pointLaneGap
    )

    return {
      '--timeline-base-height': `${baseHeight}px`,
      '--span-lane-gap': `${spanLaneGap}px`,
      '--point-lane-gap': `${pointLaneGap}px`,
      '--span-lane-depth': spanLaneLayout.lanesPerSide,
      '--point-lane-depth': pointLaneLayout.lanesPerSide,
      '--span-lane-count': spanLaneLayout.effectiveLaneCount,
      '--point-lane-count': pointLaneLayout.effectiveLaneCount,
      '--timeline-lane-depth-px': `${laneDepthPx}px`
    }
  }, [
    isIphoneViewport,
    spanLaneLayout.lanesPerSide,
    spanLaneLayout.effectiveLaneCount,
    pointLaneLayout.lanesPerSide,
    pointLaneLayout.effectiveLaneCount
  ])

  const laneAwareEvents = useMemo(() => {
    return positionedEvents.map(event => {
      if (event.isSpan) {
        const spanLaneMeta = spanLaneLayout.laneMetadata.get(event.id)
        return {
          ...event,
          spanLaneIndex: spanLaneMeta?.laneIndex ?? 0,
          spanVisualLane: spanLaneMeta?.visualLane ?? 0,
          spanLaneRing: spanLaneMeta?.laneRing ?? 1,
          spanLaneDirection: spanLaneMeta?.laneDirection ?? -1,
          spanLaneCount: spanLaneMeta?.laneCount ?? 1,
          spanEffectiveLaneCount: spanLaneMeta?.effectiveLaneCount ?? 1
        }
      }

      const pointLaneMeta = pointLaneLayout.laneMetadata.get(event.id)
      return {
        ...event,
        pointLaneIndex: pointLaneMeta?.laneIndex ?? 0,
        pointVisualLane: pointLaneMeta?.visualLane ?? 0,
        pointLaneRing: pointLaneMeta?.laneRing ?? 1,
        pointLaneDirection: pointLaneMeta?.laneDirection ?? -1,
        pointLaneCount: pointLaneMeta?.laneCount ?? 1,
        pointEffectiveLaneCount: pointLaneMeta?.effectiveLaneCount ?? 1
      }
    })
  }, [positionedEvents, spanLaneLayout.laneMetadata, pointLaneLayout.laneMetadata])

  // Notify parent of visible events changes
  useEffect(() => {
    if (onVisibleEventsChange) {
      onVisibleEventsChange(positionedEvents)
    }
  }, [positionedEvents, onVisibleEventsChange])

  const handleEventHover = (event) => {
    setHoveredEvent(event)
  }

  // Handle view changes from the minimap
  const handleViewChange = useCallback((newStart, newEnd) => {
    setViewStart(Math.max(DEFAULT_MIN_YEARS, newStart))
    setViewEnd(Math.min(DEFAULT_MAX_YEARS, newEnd))
  }, [])

  // Reset view to show all events
  const handleReset = useCallback(() => {
    setViewStart(DEFAULT_MIN_YEARS)
    setViewEnd(CURRENT_YEAR)
  }, [eventBounds])

  // Handle mouse move over timeline to show current position
  const handleTimelineMouseMove = useCallback((e) => {
    if (!eventsLayerRef.current) return
    
    const rect = eventsLayerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = (x / rect.width) * 100
    
    // Convert position to years ago
    const yearsAgo = linearPositionToYear(percentage, viewStart, viewEnd)
    
    setTimelineHover({
      active: true,
      x: e.clientX - rect.left + 60, // Offset for the events layer margin
      yearsAgo
    })
  }, [viewStart, viewEnd])

  const handleTimelineMouseLeave = useCallback(() => {
    setTimelineHover(prev => ({ ...prev, active: false }))
  }, [])

  const formatHoverTime = (yearsAgo) => {
    if (yearsAgo <= CURRENT_YEAR) {
      const fractionalYear = CURRENT_YEAR - yearsAgo
      const year = Math.floor(fractionalYear)

      if (year >= 2000) {
        const startOfYear = new Date(year, 0, 1)
        const endOfYear = new Date(year + 1, 0, 1)
        const msInYear = endOfYear - startOfYear
        const dayOffset = (fractionalYear - year) * msInYear
        const date = new Date(startOfYear.getTime() + dayOffset)
        const dd = String(date.getDate()).padStart(2, '0')
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        return `${dd}.${mm}.${date.getFullYear()}`
      }

      if (year < 0) {
        return `${Math.abs(year)} BCE`
      }
      return `${year} CE`
    }
    
    if (yearsAgo >= 1e9) {
      return `${(yearsAgo / 1e9).toFixed(2)} billion years ago`
    } else if (yearsAgo >= 1e6) {
      return `${(yearsAgo / 1e6).toFixed(2)} million years ago`
    } else if (yearsAgo >= 1e3) {
      return `${(yearsAgo / 1e3).toFixed(1)}k years ago`
    } else {
      return `${Math.round(yearsAgo)} years ago`
    }
  }

  return (
    <div className="history-arrow-container">
      <div className="timeline-header">
        <h3 className="timeline-title">Timeline of History</h3>
        <button className="reset-view-btn" onClick={handleReset}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset View
        </button>
      </div>

      <div 
        className="timeline-wrapper" 
        ref={timelineRef}
        style={timelineLayoutStyle}
      >
        <motion.div
          className="timeline-content"
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Main Arrow Line */}
          <div className="arrow-line">
            <div className="arrow-body" />
            <div className="arrow-head">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l8 8-8 8V4z" />
              </svg>
            </div>
          </div>

          {/* Timeline Ticks */}
          <div className="timeline-ticks">
            {timelineTicks.map((tick, index) => (
              <div
                key={index}
                className="timeline-tick"
                style={{ left: `${tick.position}%` }}
              >
                <div className="tick-mark" />
                <span className="tick-label">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>

          {/* Event Markers */}
          <div 
            ref={eventsLayerRef}
            className="events-layer"
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
          >
            {laneAwareEvents.map(event => {
              const eventLabelColor = labelColorMap.get(event.label) || null

              return (
                <EventMarker
                  key={event.id}
                  event={event}
                  onHover={handleEventHover}
                  onClick={onEventClick}
                  isHovered={hoveredEvent?.id === event.id}
                  isSelected={selectedEvent?.id === event.id}
                  showLabel
                  labelColor={eventLabelColor}
                />
              )
            })}
          </div>

          {/* View range labels */}
          <div className="view-range-labels">
            <span className="range-label past">
              {formatYearsAgoShort(viewEnd)} ago
            </span>
            <span className="range-label present">
              {formatYearsAgoShort(viewStart)} ago
            </span>
          </div>

          {/* Hover time indicator */}
          {timelineHover.active && (
            <motion.div 
              className="timeline-hover-indicator"
              style={{ left: timelineHover.x }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <div className="hover-line" />
              <span className="hover-time">{formatHoverTime(timelineHover.yearsAgo)}</span>
            </motion.div>
          )}
        </motion.div>

      </div>

      {/* Logarithmic Minimap */}
      <LogarithmicMinimap
        viewStart={viewStart}
        viewEnd={viewEnd}
        onViewChange={handleViewChange}
        events={events}
        totalMin={DEFAULT_MIN_YEARS}
        totalMax={DEFAULT_MAX_YEARS}
        labelColorMap={labelColorMap}
      />

      {/* Timeline Legend */}
      <div className="timeline-legend">
        <div className="legend-item">
          <span className="legend-point" />
          <span>Point Event</span>
        </div>
        <div className="legend-item">
          <span className="legend-span" />
          <span>Time Span</span>
        </div>
      </div>
    </div>
  )
})

export default HistoryArrow
