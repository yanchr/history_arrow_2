import { useState, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import EventMarker from './EventMarker'
import ClusterIndicator from './ClusterIndicator'
import LogarithmicMinimap from './LogarithmicMinimap'
import {
  yearToLinearPosition,
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
  getPriorityThreshold,
  shouldShowLabel,
  getClusterZoomBounds
} from '../utils/clusterUtils'
import './HistoryArrow.css'

function HistoryArrow({ events, selectedEvent, onEventClick }) {
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [hoveredCluster, setHoveredCluster] = useState(null)
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

  // Detect clusters of overlapping events
  const clusters = useMemo(() => {
    // Only cluster point events, not spans
    const pointEvents = positionedEvents.filter(e => !e.isSpan)
    return detectClusters(pointEvents, 3) // 3% threshold
  }, [positionedEvents])

  // Get IDs of events that are part of clusters
  const clusteredEventIds = useMemo(() => {
    return getClusteredEventIds(clusters)
  }, [clusters])

  // Calculate priority threshold based on zoom level
  const priorityThreshold = useMemo(() => {
    return getPriorityThreshold(viewStart, viewEnd, DEFAULT_MIN_YEARS, DEFAULT_MAX_YEARS)
  }, [viewStart, viewEnd])

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

  // Handle cluster click to zoom into cluster
  const handleClusterClick = useCallback((cluster) => {
    const { viewStart: newStart, viewEnd: newEnd } = getClusterZoomBounds(cluster)
    handleViewChange(newStart, newEnd)
  }, [handleViewChange])

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
          <div className={`events-layer ${hoveredCluster ? 'has-hovered-cluster' : ''}`}>
            {positionedEvents.map(event => {
              const isInCluster = clusteredEventIds.has(event.id)
              const showLabel = shouldShowLabel(event, priorityThreshold, clusteredEventIds)
              
              // Check if this event is in the currently hovered cluster
              const isInHoveredCluster = hoveredCluster?.events?.some(e => e.id === event.id)
              
              // Calculate fisheye offset for events in hovered cluster
              let fisheyeOffset = 0
              if (isInHoveredCluster && hoveredCluster) {
                const clusterEvents = hoveredCluster.events
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
                  isDimmed={hoveredCluster && !isInHoveredCluster}
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
}

export default HistoryArrow
