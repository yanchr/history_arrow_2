import { motion } from 'framer-motion'
import { formatDisplayDate } from '../utils/dateUtils'
import './EventTooltip.css'

function EventTooltip({ event, position }) {
  const { title, description, start_date, end_date } = event

  // Determine tooltip placement
  const tooltipX = position.x > 300 ? position.x - 320 : position.x + 20
  const tooltipY = position.y > 100 ? position.y - 100 : position.y + 20

  return (
    <motion.div
      className="event-tooltip"
      style={{
        left: tooltipX,
        top: tooltipY
      }}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="tooltip-header">
        <h3 className="tooltip-title">{title}</h3>
        <div className="tooltip-date">
          {end_date ? (
            <>
              <span>{formatDisplayDate(start_date)}</span>
              <span className="date-separator">→</span>
              <span>{formatDisplayDate(end_date)}</span>
            </>
          ) : (
            <span>{formatDisplayDate(start_date)}</span>
          )}
        </div>
      </div>
      
      {description && (
        <div className="tooltip-body">
          <p className="tooltip-description">{description}</p>
        </div>
      )}

      <div className="tooltip-footer">
        <span className="tooltip-type">
          {end_date ? 'Time Span' : 'Point Event'}
        </span>
      </div>

      <div className="tooltip-arrow" />
    </motion.div>
  )
}

export default EventTooltip
