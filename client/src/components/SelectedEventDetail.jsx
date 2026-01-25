import { motion } from 'framer-motion'
import { formatEventDate } from '../utils/dateUtils'
import './SelectedEventDetail.css'

function SelectedEventDetail({ event, onClose }) {
  if (!event) return null

  const { title, description, date_type } = event

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
      className="selected-event-detail"
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="selected-event-content">
        <div className="selected-event-header">
          <div className="selected-event-badges">
            <span className={`event-badge ${date_type === 'astronomical' ? 'astronomical' : 'historical'}`}>
              {eventTypeLabel}
            </span>
            <span className={`event-badge ${isSpan ? 'span' : 'point'}`}>
              {isSpan ? 'Time Span' : 'Point Event'}
            </span>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="selected-event-title">{title}</h2>

        <div className="selected-event-dates">
          {isSpan && endDateDisplay ? (
            <>
              <span className="date-value">{startDateDisplay}</span>
              <span className="date-separator">→</span>
              <span className="date-value">{endDateDisplay}</span>
            </>
          ) : (
            <span className="date-value">{startDateDisplay}</span>
          )}
        </div>

        {description && (
          <p className="selected-event-description">{description}</p>
        )}
      </div>

      <div className="selected-event-indicator">
        <span>Click another event to view details, or</span>
        <button className="text-btn" onClick={onClose}>dismiss</button>
      </div>
    </motion.div>
  )
}

export default SelectedEventDetail
