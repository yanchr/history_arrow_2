import { motion, AnimatePresence } from 'framer-motion'
import './ClusterIndicator.css'

function ClusterIndicator({ cluster, onClick, isHovered, onHover }) {
  const { position, count } = cluster

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

  const hoverZoneWidth = Math.min(20, count * 5)

  return (
    <motion.div
      className={`cluster-indicator ${isHovered ? 'hovered' : ''}`}
      style={{ 
        left: `${position}%`,
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
    </motion.div>
  )
}

export default ClusterIndicator
