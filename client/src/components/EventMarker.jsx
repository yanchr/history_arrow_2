import { motion } from 'framer-motion'
import './EventMarker.css'

function EventMarker({ event, onHover, onClick, isHovered, isSelected }) {
  const { startPos, endPos, isSpan, title } = event

  const handleMouseEnter = (e) => {
    onHover(event, e)
  }

  const handleMouseMove = (e) => {
    onHover(event, e)
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

  if (isSpan) {
    // Render as a span (range marker)
    const width = Math.max(endPos - startPos, 2)

    return (
      <motion.div
        className={`event-span ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
        style={{
          left: `${startPos}%`,
          width: `${width}%`
        }}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="span-body">
          <div className="span-start-cap" />
          <div className="span-fill" />
          <div className="span-end-cap" />
        </div>
        <span className="span-label">{title}</span>
      </motion.div>
    )
  }

  // Render as a point marker
  return (
    <motion.div
      className={`event-point ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
      style={{ left: `${startPos}%` }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="point-marker">
        <div className="point-inner" />
        <div className="point-pulse" />
      </div>
      <span className="point-label">{title}</span>
    </motion.div>
  )
}

export default EventMarker
