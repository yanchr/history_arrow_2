import { motion, AnimatePresence } from 'framer-motion'
import './ClusterIndicator.css'

function ClusterIndicator({ cluster, onClick, isHovered, onHover }) {
  const { position, count, events, maxPriority } = cluster

  const handleMouseEnter = () => {
    if (onHover) onHover(cluster)
  }

  const handleMouseLeave = () => {
    if (onHover) onHover(null)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (onClick) onClick(cluster)
  }

  // Calculate hover zone width based on number of events
  const hoverZoneWidth = Math.min(20, count * 5) // Max 20% width for hover zone

  return (
    <motion.div
      className={`cluster-indicator priority-${maxPriority} ${isHovered ? 'hovered' : ''}`}
      style={{ 
        left: `${position}%`,
        // Expand hover zone when hovered to cover the spread events
        width: isHovered ? `${hoverZoneWidth}%` : 'auto',
        marginLeft: isHovered ? `-${hoverZoneWidth / 2}%` : '0'
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* The visible badge - fades out on hover to reveal spread events */}
      <AnimatePresence>
        {!isHovered && (
          <motion.div 
            className="cluster-badge-wrapper"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="cluster-badge">
              <span className="cluster-count">{count}</span>
              <svg 
                className="cluster-icon" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="cluster-label">Events</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hover hint - shows when hovering */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            className="cluster-hover-hint"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <span className="hint-text">Click to zoom in</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default ClusterIndicator
