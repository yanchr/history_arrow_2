import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  yearToLogPosition,
  logPositionToYear,
  getLogTicks,
  getEraMarkers,
  formatYearsAgoShort,
  eventToYearsAgo,
  DEFAULT_MIN_YEARS,
  DEFAULT_MAX_YEARS
} from '../utils/logScaleUtils'
import './LogarithmicMinimap.css'

function LogarithmicMinimap({
  viewStart,
  viewEnd,
  onViewChange,
  events = [],
  totalMin = DEFAULT_MIN_YEARS,
  totalMax = DEFAULT_MAX_YEARS
}) {
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState(null) // 'move', 'left', 'right'
  const [dragStartX, setDragStartX] = useState(0)
  const [initialView, setInitialView] = useState({ start: viewStart, end: viewEnd })

  // Calculate viewfinder position from years
  const viewfinderLeft = yearToLogPosition(viewEnd, totalMin, totalMax)
  const viewfinderRight = yearToLogPosition(viewStart, totalMin, totalMax)
  const viewfinderWidth = viewfinderRight - viewfinderLeft

  // Get tick marks and era markers
  const ticks = getLogTicks(totalMin, totalMax)
  const eras = getEraMarkers()

  // Convert events to minimap dots
  const eventDots = events.map(event => {
    const yearsAgo = eventToYearsAgo(event)
    const position = yearToLogPosition(yearsAgo, totalMin, totalMax)
    return { id: event.id, position, title: event.title, priority: event.priority || 3 }
  })

  // Handle mouse down on viewfinder
  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragType(type)
    setDragStartX(e.clientX)
    setInitialView({ start: viewStart, end: viewEnd })
  }, [viewStart, viewEnd])

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const deltaX = e.clientX - dragStartX
    const deltaPercent = (deltaX / rect.width) * 100

    const initialLeftPos = yearToLogPosition(initialView.end, totalMin, totalMax)
    const initialRightPos = yearToLogPosition(initialView.start, totalMin, totalMax)

    let newLeftPos, newRightPos

    if (dragType === 'move') {
      // Move the entire viewfinder
      newLeftPos = Math.max(0, Math.min(100 - (initialRightPos - initialLeftPos), initialLeftPos + deltaPercent))
      newRightPos = newLeftPos + (initialRightPos - initialLeftPos)
    } else if (dragType === 'left') {
      // Resize from left edge (changes end/older boundary)
      newLeftPos = Math.max(0, Math.min(initialRightPos - 1, initialLeftPos + deltaPercent))
      newRightPos = initialRightPos
    } else if (dragType === 'right') {
      // Resize from right edge (changes start/newer boundary)
      newLeftPos = initialLeftPos
      newRightPos = Math.max(initialLeftPos + 1, Math.min(100, initialRightPos + deltaPercent))
    }

    // Convert positions back to years
    const newEnd = logPositionToYear(newLeftPos, totalMin, totalMax)
    const newStart = logPositionToYear(newRightPos, totalMin, totalMax)

    onViewChange(newStart, newEnd)
  }, [isDragging, dragType, dragStartX, initialView, totalMin, totalMax, onViewChange])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragType(null)
  }, [])

  // Handle click on minimap background to jump
  const handleMinimapClick = useCallback((e) => {
    if (!containerRef.current || isDragging) return

    const rect = containerRef.current.getBoundingClientRect()
    const clickPercent = ((e.clientX - rect.left) / rect.width) * 100
    const clickedYears = logPositionToYear(clickPercent, totalMin, totalMax)

    // Calculate current view span in log space
    const currentSpan = Math.abs(Math.log10(viewEnd) - Math.log10(viewStart))
    const halfSpan = currentSpan / 2

    // Center the view on the clicked position
    const logClicked = Math.log10(clickedYears)
    const newStart = Math.pow(10, logClicked - halfSpan)
    const newEnd = Math.pow(10, logClicked + halfSpan)

    onViewChange(
      Math.max(totalMin, newStart),
      Math.min(totalMax, newEnd)
    )
  }, [isDragging, viewStart, viewEnd, totalMin, totalMax, onViewChange])

  // Handle pan left (go back in time / further into past)
  const handlePanLeft = useCallback(() => {
    const logStart = Math.log10(viewStart)
    const logEnd = Math.log10(viewEnd)
    const currentSpan = logEnd - logStart
    const panAmount = currentSpan * 0.25 // Pan by 25% of the visible range

    const newLogStart = logStart + panAmount
    const newLogEnd = logEnd + panAmount

    // Clamp to bounds
    if (Math.pow(10, newLogEnd) > totalMax) {
      const overflow = newLogEnd - Math.log10(totalMax)
      onViewChange(
        Math.pow(10, newLogStart - overflow),
        totalMax
      )
    } else {
      onViewChange(
        Math.pow(10, newLogStart),
        Math.pow(10, newLogEnd)
      )
    }
  }, [viewStart, viewEnd, totalMax, onViewChange])

  // Handle pan right (go forward in time / closer to present)
  const handlePanRight = useCallback(() => {
    const logStart = Math.log10(viewStart)
    const logEnd = Math.log10(viewEnd)
    const currentSpan = logEnd - logStart
    const panAmount = currentSpan * 0.25 // Pan by 25% of the visible range

    const newLogStart = logStart - panAmount
    const newLogEnd = logEnd - panAmount

    // Clamp to bounds
    if (Math.pow(10, newLogStart) < totalMin) {
      const overflow = Math.log10(totalMin) - newLogStart
      onViewChange(
        totalMin,
        Math.pow(10, newLogEnd + overflow)
      )
    } else {
      onViewChange(
        Math.pow(10, newLogStart),
        Math.pow(10, newLogEnd)
      )
    }
  }, [viewStart, viewEnd, totalMin, onViewChange])

  // Handle zoom in (make viewfinder smaller / narrower range)
  const handleZoomIn = useCallback(() => {
    const logStart = Math.log10(viewStart)
    const logEnd = Math.log10(viewEnd)
    const currentSpan = logEnd - logStart
    const zoomFactor = 0.7 // Zoom in by 30%

    const newSpan = Math.max(0.5, currentSpan * zoomFactor)
    const center = (logStart + logEnd) / 2

    onViewChange(
      Math.max(totalMin, Math.pow(10, center - newSpan / 2)),
      Math.min(totalMax, Math.pow(10, center + newSpan / 2))
    )
  }, [viewStart, viewEnd, totalMin, totalMax, onViewChange])

  // Handle zoom out (make viewfinder larger / wider range)
  const handleZoomOut = useCallback(() => {
    const logStart = Math.log10(viewStart)
    const logEnd = Math.log10(viewEnd)
    const currentSpan = logEnd - logStart
    const zoomFactor = 1.4 // Zoom out by 40%

    const newSpan = Math.min(10, currentSpan * zoomFactor)
    const center = (logStart + logEnd) / 2

    onViewChange(
      Math.max(totalMin, Math.pow(10, center - newSpan / 2)),
      Math.min(totalMax, Math.pow(10, center + newSpan / 2))
    )
  }, [viewStart, viewEnd, totalMin, totalMax, onViewChange])

  // Add global mouse listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Handle keyboard navigation with arrow keys
  const handleKeyDown = useCallback((e) => {
    // Only handle arrow keys
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      return
    }

    // Prevent default scrolling behavior for up/down arrows
    e.preventDefault()

    switch (e.key) {
      case 'ArrowLeft':
        handlePanLeft()
        break
      case 'ArrowRight':
        handlePanRight()
        break
      case 'ArrowUp':
        handleZoomIn()
        break
      case 'ArrowDown':
        handleZoomOut()
        break
    }
  }, [handlePanLeft, handlePanRight, handleZoomIn, handleZoomOut])

  // Add global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div className="logarithmic-minimap">
      <div className="minimap-label">
        <span>Navigate Timeline</span>
        <span className="minimap-hint">Drag to pan, edges to zoom, arrow keys, or buttons</span>
      </div>

      <div className="minimap-with-controls">
        {/* Left pan button */}
        <button
          className="minimap-nav-btn pan-left"
          onClick={handlePanLeft}
          title="Go back in time (further into past)"
          aria-label="Pan left"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="minimap-center">
          {/* Zoom buttons */}
          <div className="minimap-zoom-controls">
            <button
              className="minimap-nav-btn zoom-out"
              onClick={handleZoomOut}
              title="Zoom out (wider view)"
              aria-label="Zoom out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6 6-6-6" />
              </svg>
            </button>
            <button
              className="minimap-nav-btn zoom-in"
              onClick={handleZoomIn}
              title="Zoom in (narrower view)"
              aria-label="Zoom in"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6-6 6 6" />
              </svg>
            </button>
          </div>

          <div
            ref={containerRef}
            className="minimap-container"
            onClick={handleMinimapClick}
          >
        {/* Era backgrounds */}
        <div className="minimap-eras">
          {eras.map((era, index) => {
            const left = yearToLogPosition(era.startYearsAgo, totalMin, totalMax)
            const right = yearToLogPosition(era.endYearsAgo, totalMin, totalMax)
            const width = right - left

            return (
              <div
                key={index}
                className="minimap-era"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: era.color
                }}
                title={era.name}
              >
                {width > 8 && <span className="era-label">{era.name}</span>}
              </div>
            )
          })}
        </div>

        {/* Tick marks */}
        <div className="minimap-ticks">
          {ticks.map((tick, index) => (
            <div
              key={index}
              className="minimap-tick"
              style={{ left: `${tick.position}%` }}
            >
              <div className="tick-line" />
              <span className="tick-label">{tick.label}</span>
            </div>
          ))}
        </div>

        {/* Event dots */}
        <div className="minimap-events">
          {eventDots.map(dot => (
            <div
              key={dot.id}
              className={`minimap-event-dot priority-${dot.priority}`}
              style={{ left: `${dot.position}%` }}
              title={dot.title}
            />
          ))}
        </div>

        {/* Viewfinder */}
        <motion.div
          className={`minimap-viewfinder ${isDragging ? 'dragging' : ''}`}
          style={{
            left: `${viewfinderLeft}%`,
            width: `${Math.max(2, viewfinderWidth)}%`
          }}
          animate={{
            left: `${viewfinderLeft}%`,
            width: `${Math.max(2, viewfinderWidth)}%`
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Left resize handle */}
          <div
            className="viewfinder-handle left"
            onMouseDown={(e) => handleMouseDown(e, 'left')}
          />

          {/* Center drag area */}
          <div
            className="viewfinder-center"
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          />

          {/* Right resize handle */}
          <div
            className="viewfinder-handle right"
            onMouseDown={(e) => handleMouseDown(e, 'right')}
          />
        </motion.div>

          {/* Present marker */}
          <div className="minimap-present-marker" title="Present">
            <span>Now</span>
          </div>
        </div>
      </div>

        {/* Right pan button */}
        <button
          className="minimap-nav-btn pan-right"
          onClick={handlePanRight}
          title="Go forward in time (closer to present)"
          aria-label="Pan right"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Current view info */}
      <div className="minimap-view-info">
        <span>{formatYearsAgoShort(viewEnd)} ago</span>
        <span className="view-separator">—</span>
        <span>{formatYearsAgoShort(viewStart)} ago</span>
      </div>
    </div>
  )
}

export default LogarithmicMinimap
