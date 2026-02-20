import { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion } from 'framer-motion'
import EventMarker from './EventMarker'
import ClusterIndicator from './ClusterIndicator'
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
import {
  detectClusters,
  getClusteredEventIds,
  shouldShowLabel,
  getClusterZoomBounds
} from '../utils/clusterUtils'
import './HistoryArrow.css'

// Current date as a fractional year (e.g. 2026.14 for mid-February 2026)
const NOW = new Date()
const YEAR_START = new Date(NOW.getFullYear(), 0, 1)
const YEAR_END = new Date(NOW.getFullYear() + 1, 0, 1)
const CURRENT_YEAR = NOW.getFullYear() + (NOW - YEAR_START) / (YEAR_END - YEAR_START)

const HistoryArrow = forwardRef(function HistoryArrow({ events, selectedEvent, onEventClick, onVisibleEventsChange, labelColorMap = new Map() }, ref) {
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [hoveredCluster, setHoveredCluster] = useState(null)
  const [timelineHover, setTimelineHover] = useState({ active: false, x: 0, yearsAgo: 0 })
  // View state: years ago for the visible range
  // viewStart = closer to present (smaller years ago)
  // viewEnd = further in past (larger years ago)
  const [viewStart, setViewStart] = useState(DEFAULT_MIN_YEARS)
  const [viewEnd, setViewEnd] = useState(CURRENT_YEAR) // Default to year 0 (2026 years ago)
  const timelineRef = useRef(null)
  const eventsLayerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    centerOnEvent(event) {
      const yearsAgo = eventToYearsAgo(event)
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

  // Notify parent of visible events changes
  useEffect(() => {
    if (onVisibleEventsChange) {
      onVisibleEventsChange(positionedEvents)
    }
  }, [positionedEvents, onVisibleEventsChange])

  // Detect clusters of overlapping events
  const clusters = useMemo(() => {
    // Only cluster point events, not spans
    const pointEvents = positionedEvents.filter(e => !e.isSpan)
    return detectClusters(pointEvents, 1.5) // 1.5% threshold - only cluster when really close
  }, [positionedEvents])

  // Get IDs of events that are part of clusters
  const clusteredEventIds = useMemo(() => {
    return getClusteredEventIds(clusters)
  }, [clusters])

  const handleEventHover = (event) => {
    setHoveredEvent(event)
  }

  const handleClusterHover = (cluster) => {
    setHoveredCluster(cluster)
  }

  // Handle view changes from the minimap
  const handleViewChange = useCallback((newStart, newEnd) => {
    setViewStart(Math.max(DEFAULT_MIN_YEARS, newStart))
    setViewEnd(Math.min(DEFAULT_MAX_YEARS, newEnd))
  }, [])

  const handleClusterClick = useCallback((cluster) => {
    setHoveredCluster(null)
    const { viewStart: newStart, viewEnd: newEnd } = getClusterZoomBounds(cluster)
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
            className={`events-layer ${hoveredCluster ? 'has-hovered-cluster' : ''}`}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
          >
            {positionedEvents.map(event => {
              const isInCluster = clusteredEventIds.has(event.id)
              const showLabel = shouldShowLabel(event, clusteredEventIds)
              const eventLabelColor = labelColorMap.get(event.label) || null
              
              const activeCluster = hoveredCluster
              
              // Check if this event is in the currently active (hovered or locked) cluster
              const isInHoveredCluster = activeCluster?.events?.some(e => e.id === event.id)
              
              // Calculate fisheye offset for events in active cluster
              let fisheyeOffset = 0
              if (isInHoveredCluster && activeCluster) {
                const clusterEvents = activeCluster.events
                const eventIndex = clusterEvents.findIndex(e => e.id === event.id)
                const totalEvents = clusterEvents.length
                // Spread events evenly around the cluster center
                const spreadWidth = Math.min(15, totalEvents * 4) // Max 15% spread
                fisheyeOffset = ((eventIndex - (totalEvents - 1) / 2) / Math.max(1, totalEvents - 1)) * spreadWidth
              }
              
              return (
                <EventMarker
                  key={event.id}
                  event={event}
                  onHover={handleEventHover}
                  onClick={onEventClick}
                  isHovered={hoveredEvent?.id === event.id}
                  isSelected={selectedEvent?.id === event.id}
                  showLabel={showLabel || isInHoveredCluster}
                  isInCluster={isInCluster}
                  isInHoveredCluster={isInHoveredCluster}
                  fisheyeOffset={fisheyeOffset}
                  isDimmed={activeCluster && !isInHoveredCluster}
                  labelColor={eventLabelColor}
                />
              )
            })}
            
            {/* Cluster Indicators */}
            {clusters.map(cluster => (
              <ClusterIndicator
                key={cluster.id}
                cluster={cluster}
                onClick={handleClusterClick}
                onHover={handleClusterHover}
                isHovered={hoveredCluster?.id === cluster.id}
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
