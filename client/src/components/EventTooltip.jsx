import { motion } from 'framer-motion'
import { formatEventDate } from '../utils/dateUtils'
import './EventTooltip.css'

function EventTooltip({ event, position }) {
  const { title, description, date_type } = event

  // Determine tooltip placement
  const tooltipX = position.x > 300 ? position.x - 320 : position.x + 20
  const tooltipY = position.y > 100 ? position.y - 100 : position.y + 20

  // Get formatted dates based on event type
  const startDateDisplay = formatEventDate(event, false)
  const endDateDisplay = formatEventDate(event, true)

  // Determine if this is a span based on the event type
  const isSpan = date_type === 'astronomical'
    ? !!event.astronomical_end_year
    : !!event.end_date

  // Get event type label
  const eventTypeLabel = date_type === 'astronomical' ? 'Astronomical' : 'Historical'

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
          {isSpan && endDateDisplay ? (
            <>
              <span>{startDateDisplay}</span>
              <span className="date-separator">→</span>
              <span>{endDateDisplay}</span>
            </>
          ) : (
            <span>{startDateDisplay}</span>
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
          {eventTypeLabel} • {isSpan ? 'Time Span' : 'Point Event'}
        </span>
      </div>

      <div className="tooltip-arrow" />
    </motion.div>
  )
}

export default EventTooltip
