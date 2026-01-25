import { useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import EventMarker from './EventMarker'
import EventTooltip from './EventTooltip'
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

function HistoryArrow({ events, selectedEvent, onEventClick }) {
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  // View state: years ago for the visible range
  // viewStart = closer to present (smaller years ago)
  // viewEnd = further in past (larger years ago)
  const [viewStart, setViewStart] = useState(1) // 1 year ago
  const [viewEnd, setViewEnd] = useState(5e9) // 5 billion years ago
  const timelineRef = useRef(null)

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

  const handleEventHover = (event, e) => {
    if (!event) {
      setHoveredEvent(null)
      return
    }

    const rect = timelineRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltipPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
    setHoveredEvent(event)
  }

  // Handle view changes from the minimap
  const handleViewChange = useCallback((newStart, newEnd) => {
    setViewStart(Math.max(DEFAULT_MIN_YEARS, newStart))
    setViewEnd(Math.min(DEFAULT_MAX_YEARS, newEnd))
  }, [])

  // Handle wheel zoom on the main timeline
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (!timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const mousePercent = ((e.clientX - rect.left) / rect.width) * 100
    // Use LINEAR position to year since the arrow display is linear
    const mouseYears = linearPositionToYear(mousePercent, viewStart, viewEnd)

    // Zoom factor
    const zoomFactor = e.deltaY > 0 ? 1.3 : 0.77

    // Calculate new span - use logarithmic zoom for smooth navigation across scales
    const logStart = Math.log10(viewStart)
    const logEnd = Math.log10(viewEnd)
    const currentSpan = logEnd - logStart
    const newSpan = Math.max(0.5, Math.min(10, currentSpan * zoomFactor))

    // Maintain relative position of mouse within the view (in linear space)
    const mouseRelative = (mouseYears - viewStart) / (viewEnd - viewStart)
    const logMouse = Math.log10(mouseYears)
    const newLogStart = logMouse - mouseRelative * newSpan
    const newLogEnd = logMouse + (1 - mouseRelative) * newSpan

    handleViewChange(
      Math.pow(10, newLogStart),
      Math.pow(10, newLogEnd)
    )
  }, [viewStart, viewEnd, handleViewChange])

  // Reset view to show all events
  const handleReset = useCallback(() => {
    setViewStart(eventBounds.min)
    setViewEnd(eventBounds.max)
  }, [eventBounds])

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
        onWheel={handleWheel}
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
          <div className="events-layer">
            {positionedEvents.map(event => (
              <EventMarker
                key={event.id}
                event={event}
                onHover={handleEventHover}
                onClick={onEventClick}
                isHovered={hoveredEvent?.id === event.id}
                isSelected={selectedEvent?.id === event.id}
              />
            ))}
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
        </motion.div>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredEvent && (
            <EventTooltip
              event={hoveredEvent}
              position={tooltipPosition}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Logarithmic Minimap */}
      <LogarithmicMinimap
        viewStart={viewStart}
        viewEnd={viewEnd}
        onViewChange={handleViewChange}
        events={events}
        totalMin={DEFAULT_MIN_YEARS}
        totalMax={DEFAULT_MAX_YEARS}
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
        <div className="legend-item legend-hint">
          <span>Scroll to zoom</span>
        </div>
      </div>
    </div>
  )
}

export default HistoryArrow
