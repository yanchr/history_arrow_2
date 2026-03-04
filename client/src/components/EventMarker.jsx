import { motion, AnimatePresence } from 'framer-motion'
import './EventMarker.css'

const MIN_SPAN_WIDTH_PERCENT = 1.2

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
  disablePointerEvents = false
}) {
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
    onHover(event)
  }

  const handleMouseLeave = () => {
    onHover(null)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (onClick) {
      onClick(event)
    }
  }

  const resolvedMarkerColor = markerColor || labelColor || '#00d4ff'

  // For spans, always show labels (they're usually important periods)
  if (isSpan) {
    const spanLeft = Math.min(startPos, endPos)
    const spanWidth = Math.abs(endPos - startPos)
    const width = Math.max(spanWidth, MIN_SPAN_WIDTH_PERCENT)
    const laneOffset = spanLaneDirection * spanLaneRing
    const isBelowBaseline = spanLaneDirection > 0

    return (
      <motion.div
        className={`event-span ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${className}`.trim()}
        style={{
          left: `${spanLeft}%`,
          width: `${width}%`,
          top: `calc(50% + (${laneOffset} * var(--span-lane-gap, 22px)))`,
          '--label-color': resolvedMarkerColor,
          '--marker-color': resolvedMarkerColor,
          pointerEvents: disablePointerEvents ? 'none' : undefined
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
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
      className={`event-point ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${className}`.trim()}
      style={{
        left: `${startPos}%`,
        top: `calc(50% + (${pointLaneOffset} * var(--point-lane-gap, 28px)))`,
        '--label-color': resolvedMarkerColor,
        '--marker-color': resolvedMarkerColor,
        pointerEvents: disablePointerEvents ? 'none' : undefined
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1,
        scale: 1
      }}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
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
