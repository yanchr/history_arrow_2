import { motion } from 'framer-motion'
import './TimelineControls.css'

function TimelineControls({ 
  onZoomIn, 
  onZoomOut, 
  onPanLeft, 
  onPanRight, 
  onReset,
  zoomLevel 
}) {
  return (
    <div className="timeline-controls">
      <div className="controls-group">
        <motion.button
          className="control-btn"
          onClick={onPanLeft}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Pan Left"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </motion.button>

        <motion.button
          className="control-btn"
          onClick={onPanRight}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Pan Right"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </motion.button>
      </div>

      <div className="controls-group">
        <motion.button
          className="control-btn"
          onClick={onZoomOut}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Zoom Out"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
        </motion.button>

        <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>

        <motion.button
          className="control-btn"
          onClick={onZoomIn}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Zoom In"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </motion.button>
      </div>

      <motion.button
        className="control-btn reset-btn"
        onClick={onReset}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Reset View"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        <span>Reset</span>
      </motion.button>
    </div>
  )
}

export default TimelineControls
