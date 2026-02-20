import { motion, AnimatePresence } from 'framer-motion'
import './EventMarker.css'

function EventMarker({ 
  event, 
  onHover, 
  onClick, 
  isHovered, 
  isSelected,
  showLabel = true,
  isInCluster = false,
  isInHoveredCluster = false,
  fisheyeOffset = 0,
  isDimmed = false,
  labelColor = null
}) {
  const { startPos, endPos, isSpan, title } = event

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

  // For spans, always show labels (they're usually important periods)
  if (isSpan) {
    const width = Math.max(endPos - startPos, 2)

    return (
      <motion.div
        className={`event-span ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
        style={{
          left: `${startPos}%`,
          width: `${width}%`,
          '--label-color': labelColor || '#00d4ff'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: isDimmed ? 0.3 : 1, scaleX: 1 }}
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
          {(showLabel || isHovered || isSelected) && !isDimmed && (
            <motion.span 
              className="span-label"
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

  // For point markers in a cluster - show them if cluster is hovered (fisheye effect)
  if (isInCluster && !isInHoveredCluster) {
    return null
  }

  // Calculate the actual position with fisheye offset
  const actualPosition = startPos + fisheyeOffset

  // Render as a point marker
  return (
    <motion.div
      className={`event-point ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${isInHoveredCluster ? 'fisheye-active' : ''} ${isDimmed ? 'dimmed' : ''}`}
      style={{ left: `${actualPosition}%`, '--label-color': labelColor || '#00d4ff' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: isDimmed ? 0.3 : 1, 
        scale: isInHoveredCluster ? 1.2 : 1,
        left: `${actualPosition}%`
      }}
      whileHover={{ scale: isInHoveredCluster ? 1.4 : 1.2 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="point-marker">
        <div className="point-inner" />
        <div className="point-pulse" />
      </div>
      <AnimatePresence>
        {(showLabel || isHovered || isSelected || isInHoveredCluster) && !isDimmed && (
          <motion.span 
            className="point-label"
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
