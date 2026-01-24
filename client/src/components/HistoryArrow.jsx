import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import EventMarker from './EventMarker'
import EventTooltip from './EventTooltip'
import TimelineControls from './TimelineControls'
import { formatTimelineDate, getTimePosition } from '../utils/dateUtils'
import './HistoryArrow.css'

function HistoryArrow({ events }) {
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  const timelineRef = useRef(null)

  // Calculate timeline bounds from events
  const timelineBounds = useMemo(() => {
    if (!events || events.length === 0) {
      return { min: new Date('1800-01-01'), max: new Date() }
    }

    let minDate = Infinity
    let maxDate = -Infinity

    events.forEach(event => {
      const startTime = new Date(event.start_date).getTime()
      const endTime = event.end_date ? new Date(event.end_date).getTime() : startTime
      
      if (startTime < minDate) minDate = startTime
      if (endTime > maxDate) maxDate = endTime
      if (startTime > maxDate) maxDate = startTime
    })

    // Add 5% padding on each side
    const range = maxDate - minDate
    const padding = range * 0.05

    return {
      min: new Date(minDate - padding),
      max: new Date(maxDate + padding)
    }
  }, [events])

  // Generate timeline tick marks
  const timelineTicks = useMemo(() => {
    const ticks = []
    const range = timelineBounds.max.getTime() - timelineBounds.min.getTime()
    const numTicks = Math.min(12, Math.max(5, Math.ceil(10 * zoomLevel)))
    const tickInterval = range / numTicks

    for (let i = 0; i <= numTicks; i++) {
      const date = new Date(timelineBounds.min.getTime() + i * tickInterval)
      const position = (i / numTicks) * 100
      ticks.push({ date, position })
    }

    return ticks
  }, [timelineBounds, zoomLevel])

  // Position events on the timeline
  const positionedEvents = useMemo(() => {
    return events.map(event => {
      const startPos = getTimePosition(
        new Date(event.start_date),
        timelineBounds.min,
        timelineBounds.max
      )
      const endPos = event.end_date
        ? getTimePosition(
            new Date(event.end_date),
            timelineBounds.min,
            timelineBounds.max
          )
        : null

      return {
        ...event,
        startPos,
        endPos,
        isSpan: !!event.end_date
      }
    })
  }, [events, timelineBounds])

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

  const handleZoom = (direction) => {
    setZoomLevel(prev => {
      const newZoom = direction === 'in' ? prev * 1.5 : prev / 1.5
      return Math.max(0.5, Math.min(5, newZoom))
    })
  }

  const handlePan = (direction) => {
    setPanOffset(prev => {
      const delta = direction === 'left' ? -10 : 10
      return Math.max(-50, Math.min(50, prev + delta))
    })
  }

  const resetView = () => {
    setZoomLevel(1)
    setPanOffset(0)
  }

  return (
    <div className="history-arrow-container">
      <TimelineControls
        onZoomIn={() => handleZoom('in')}
        onZoomOut={() => handleZoom('out')}
        onPanLeft={() => handlePan('left')}
        onPanRight={() => handlePan('right')}
        onReset={resetView}
        zoomLevel={zoomLevel}
      />

      <div className="timeline-wrapper" ref={timelineRef}>
        <motion.div
          className="timeline-content"
          style={{
            transform: `scaleX(${zoomLevel}) translateX(${panOffset}px)`,
            transformOrigin: 'center'
          }}
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
                  {formatTimelineDate(tick.date)}
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
                isHovered={hoveredEvent?.id === event.id}
              />
            ))}
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
