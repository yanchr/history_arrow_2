import { useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './EventMarker.css'

const MIN_SPAN_WIDTH_PERCENT = 1.2
const LANE_DRAG_START_THRESHOLD_PX = 6

function EventMarker({ 
  event, 
  onHover, 
  onClick, 
  isHovered, 
  isSelected,
  showLabel = true,
  labelColor = null,
  markerColor = null,
  className = '',
  disablePointerEvents = false,
  spanLongHoverMs = null,
  onSpanLongHoverComplete = null,
  enableVerticalDrag = false,
  isLaneDragging = false,
  verticalDragOffsetPx = 0,
  onLaneDragStart = null,
  onLaneDragMove = null,
  onLaneDragEnd = null
}) {
  const longHoverTimerRef = useRef(null)
  const dragStartRef = useRef(null)
  const didLaneDragRef = useRef(false)

  const clearLongHoverTimer = useCallback(() => {
    if (longHoverTimerRef.current) {
      clearTimeout(longHoverTimerRef.current)
      longHoverTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearLongHoverTimer(), [clearLongHoverTimer])
  const {
    startPos,
    endPos,
    isSpan,
    title,
    spanLaneRing = 1,
    spanLaneDirection = -1,
    pointLaneRing = 1,
    pointLaneDirection = -1
  } = event

  const handleMouseEnter = () => {
    if (isLaneDragging) return
    onHover(event)
    if (event.isSpan && spanLongHoverMs && onSpanLongHoverComplete) {
      clearLongHoverTimer()
      longHoverTimerRef.current = setTimeout(() => {
        longHoverTimerRef.current = null
        onSpanLongHoverComplete(event)
      }, spanLongHoverMs)
    }
  }

  const handleMouseLeave = () => {
    clearLongHoverTimer()
    if (!isLaneDragging) {
      onHover(null)
    }
  }

  const handlePointerDown = (e) => {
    if (!enableVerticalDrag || e.button !== 0 || disablePointerEvents) return
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    didLaneDragRef.current = false
  }

  const stopLaneDragListeners = useCallback((moveHandler, upHandler) => {
    window.removeEventListener('pointermove', moveHandler)
    window.removeEventListener('pointerup', upHandler)
    window.removeEventListener('pointercancel', upHandler)
  }, [])

  const beginLaneDrag = useCallback((clientY) => {
    didLaneDragRef.current = true
    clearLongHoverTimer()
    onHover(null)
    onLaneDragStart?.(event, clientY)

    const handleMove = (moveEvent) => {
      onLaneDragMove?.(event, moveEvent.clientY)
    }

    const handleUp = (upEvent) => {
      stopLaneDragListeners(handleMove, handleUp)
      onLaneDragEnd?.(event)
      upEvent.preventDefault()
      upEvent.stopPropagation()
      dragStartRef.current = null
      didLaneDragRef.current = false
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }, [
    clearLongHoverTimer,
    event,
    onHover,
    onLaneDragEnd,
    onLaneDragMove,
    onLaneDragStart,
    stopLaneDragListeners
  ])

  const handlePointerMove = (e) => {
    if (!enableVerticalDrag || !dragStartRef.current || disablePointerEvents || didLaneDragRef.current) {
      return
    }

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    if (
      Math.abs(deltaY) < LANE_DRAG_START_THRESHOLD_PX
      || Math.abs(deltaY) <= Math.abs(deltaX)
    ) {
      return
    }

    beginLaneDrag(dragStartRef.current.y)
    onLaneDragMove?.(event, e.clientY)
    e.preventDefault()
  }

  const handlePointerUp = (e) => {
    if (didLaneDragRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
    dragStartRef.current = null
  }

  const handlePointerCancel = (e) => {
    handlePointerUp(e)
  }

  const handleClick = (e) => {
    if (didLaneDragRef.current) {
      e.stopPropagation()
      return
    }

    e.stopPropagation()
    if (onClick) {
      onClick(event)
    }
  }

  const resolvedMarkerColor = markerColor || labelColor || '#00d4ff'
  const dragClassName = isLaneDragging ? 'event-marker--lane-dragging' : ''
  const draggableClassName = enableVerticalDrag ? 'event-marker--lane-draggable' : ''
  const dragTransform = verticalDragOffsetPx
    ? (isSpan
      ? `translateY(calc(-50% + ${verticalDragOffsetPx}px))`
      : `translate(calc(-50%), calc(-50% + ${verticalDragOffsetPx}px))`)
    : undefined

  // For spans, always show labels (they're usually important periods)
  if (isSpan) {
    const spanLeft = Math.min(startPos, endPos)
    const spanWidth = Math.abs(endPos - startPos)
    const width = Math.max(spanWidth, MIN_SPAN_WIDTH_PERCENT)
    const laneOffset = spanLaneDirection * spanLaneRing
    const isBelowBaseline = spanLaneDirection > 0

    return (
      <motion.div
        className={`event-span ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${dragClassName} ${draggableClassName} ${className}`.trim()}
        style={{
          left: `${spanLeft}%`,
          width: `${width}%`,
          top: `calc(50% + (${laneOffset} * var(--span-lane-gap, 22px)))`,
          transform: dragTransform,
          '--label-color': resolvedMarkerColor,
          '--marker-color': resolvedMarkerColor,
          pointerEvents: disablePointerEvents ? 'none' : undefined,
          touchAction: enableVerticalDrag ? 'none' : undefined
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        whileHover={isLaneDragging ? undefined : { y: -2 }}
        whileTap={isLaneDragging ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="span-body">
          <div className="span-cap span-cap-start" />
          <div className="span-line" />
          <div className="span-cap span-cap-end" />
        </div>
        <AnimatePresence>
          {(showLabel || isHovered || isSelected) && (
            <motion.span 
              className={`span-label ${isBelowBaseline ? 'span-label-below' : ''}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {title}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const pointLaneOffset = pointLaneDirection * pointLaneRing
  const isPointBelowBaseline = pointLaneDirection > 0

  // Render as a point marker
  return (
    <motion.div
      className={`event-point ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${dragClassName} ${draggableClassName} ${className}`.trim()}
      style={{
        left: `${startPos}%`,
        top: `calc(50% + (${pointLaneOffset} * var(--point-lane-gap, 28px)))`,
        transform: dragTransform,
        '--label-color': resolvedMarkerColor,
        '--marker-color': resolvedMarkerColor,
        pointerEvents: disablePointerEvents ? 'none' : undefined,
        touchAction: enableVerticalDrag ? 'none' : undefined
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1,
        scale: 1
      }}
      whileHover={isLaneDragging ? undefined : { scale: 1.2 }}
      whileTap={isLaneDragging ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="point-marker">
        <div className="point-inner" />
        <div className="point-pulse" />
      </div>
      <AnimatePresence>
        {(showLabel || isHovered || isSelected) && (
          <motion.span 
            className={`point-label ${isPointBelowBaseline ? 'point-label-below' : ''}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
          >
            {title}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default EventMarker
