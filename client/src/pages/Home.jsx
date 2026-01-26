import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HistoryArrow from '../components/HistoryArrow'
import SelectedEventDetail from '../components/SelectedEventDetail'
import { useEvents } from '../hooks/useEvents'
import { formatEventDate } from '../utils/dateUtils'
import './Home.css'

// Sample events for demonstration (using the new date_type format)
// Priority scale: 1=Minor, 2=Low, 3=Normal, 4=High, 5=Major/Anchor
const sampleEvents = [
  // Astronomical events (billions/millions of years ago)
  {
    id: 1,
    title: 'Formation of Earth',
    description: 'The Earth formed approximately 4.54 billion years ago by accretion from the solar nebula.',
    date_type: 'astronomical',
    start_date: null,
    end_date: null,
    astronomical_start_year: 4540000000,
    astronomical_end_year: null,
    priority: 5 // Major anchor event
  },
  {
    id: 2,
    title: 'Hadean Eon',
    description: 'The earliest eon in Earth\'s history, characterized by the formation of the planet and heavy bombardment by asteroids and comets.',
    date_type: 'astronomical',
    start_date: null,
    end_date: null,
    astronomical_start_year: 4600000000,
    astronomical_end_year: 4000000000,
    priority: 5 // Major anchor event
  },
  {
    id: 3,
    title: 'Cambrian Explosion',
    description: 'A period of rapid evolutionary diversification when most major animal phyla appeared in the fossil record.',
    date_type: 'astronomical',
    start_date: null,
    end_date: null,
    astronomical_start_year: 538000000,
    astronomical_end_year: 485000000,
    priority: 4 // High priority
  },
  {
    id: 4,
    title: 'Extinction of Dinosaurs',
    description: 'The Cretaceous-Paleogene extinction event caused by an asteroid impact.',
    date_type: 'astronomical',
    start_date: null,
    end_date: null,
    astronomical_start_year: 66000000,
    astronomical_end_year: null,
    priority: 5 // Major anchor event
  },
  // Calendar date events
  {
    id: 5,
    title: 'Invention of the Lightbulb',
    description: 'Thomas Edison successfully demonstrated his incandescent light bulb, revolutionizing the way humans illuminate their world.',
    date_type: 'date',
    start_date: '1879-10-21',
    end_date: null,
    astronomical_start_year: null,
    astronomical_end_year: null,
    priority: 2 // Low priority
  },
  {
    id: 6,
    title: 'World War II',
    description: 'A global conflict that lasted from 1939 to 1945, involving most of the world\'s nations divided into two opposing military alliances.',
    date_type: 'date',
    start_date: '1939-09-01',
    end_date: '1945-09-02',
    astronomical_start_year: null,
    astronomical_end_year: null,
    priority: 5 // Major anchor event
  },
  {
    id: 7,
    title: 'Moon Landing',
    description: 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon.',
    date_type: 'date',
    start_date: '1969-07-20',
    end_date: null,
    astronomical_start_year: null,
    astronomical_end_year: null,
    priority: 4 // High priority
  }
]

// Helper to check if an event is a span
const isEventSpan = (event) => {
  if (event.date_type === 'astronomical') {
    return !!event.astronomical_end_year
  }
  return !!event.end_date
}

function Home() {
  const { events, loading, error } = useEvents()
  const [displayEvents, setDisplayEvents] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [visibleEvents, setVisibleEvents] = useState([])

  // Handle event click to select/deselect
  const handleEventClick = (event) => {
    // Toggle selection - if same event clicked, deselect it
    setSelectedEvent(prev => prev?.id === event.id ? null : event)
  }

  // Close selected event detail
  const handleCloseSelectedEvent = () => {
    setSelectedEvent(null)
  }

  // Handle visible events change from timeline
  const handleVisibleEventsChange = (events) => {
    // Sort by yearsAgo descending (oldest first = highest yearsAgo first)
    const sorted = [...events].sort((a, b) => b.yearsAgo - a.yearsAgo)
    setVisibleEvents(sorted)
  }

  useEffect(() => {
    // Use fetched events if available, otherwise show sample data
    if (events && events.length > 0) {
      setDisplayEvents(events)
    } else if (!loading) {
      setDisplayEvents(sampleEvents)
    }
  }, [events, loading])

  const filteredEvents = displayEvents.filter(event => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'astronomical') return event.date_type === 'astronomical'
    if (activeFilter === 'historical') return event.date_type === 'date'
    if (activeFilter === 'points') return !isEventSpan(event)
    if (activeFilter === 'spans') return isEventSpan(event)
    return true
  })

  // Count events by type
  const astronomicalCount = displayEvents.filter(e => e.date_type === 'astronomical').length
  const historicalCount = displayEvents.filter(e => e.date_type === 'date').length

  return (
    <div className="home-page">
      <motion.section
        className="hero-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="hero-title">Explore History</h1>
        <p className="hero-subtitle">
          Journey through time with our interactive chronological explorer.
          Hover over events to preview, or click to view details.
        </p>
      </motion.section>

      <motion.section
        className="filter-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div className="filter-buttons">
          <button
            className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Events ({displayEvents.length})
          </button>
          <button
            className={`filter-btn ${activeFilter === 'astronomical' ? 'active' : ''}`}
            onClick={() => setActiveFilter('astronomical')}
          >
            Astronomical ({astronomicalCount})
          </button>
          <button
            className={`filter-btn ${activeFilter === 'historical' ? 'active' : ''}`}
            onClick={() => setActiveFilter('historical')}
          >
            Historical ({historicalCount})
          </button>
          <button
            className={`filter-btn ${activeFilter === 'points' ? 'active' : ''}`}
            onClick={() => setActiveFilter('points')}
          >
            Point Events
          </button>
          <button
            className={`filter-btn ${activeFilter === 'spans' ? 'active' : ''}`}
            onClick={() => setActiveFilter('spans')}
          >
            Time Spans
          </button>
        </div>
      </motion.section>

      <motion.section
        className="timeline-section"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading timeline...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>Using sample data (API not connected)</p>
          </div>
        ) : (
          <HistoryArrow 
            events={filteredEvents} 
            selectedEvent={selectedEvent}
            onEventClick={handleEventClick}
            onVisibleEventsChange={handleVisibleEventsChange}
          />
        )}
      </motion.section>

      {/* Selected Event Detail - appears between timeline and events list */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.section
            className="selected-event-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SelectedEventDetail 
              event={selectedEvent} 
              onClose={handleCloseSelectedEvent}
            />
          </motion.section>
        )}
      </AnimatePresence>

      <motion.section
        className="events-list-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <h2>Visible Events ({visibleEvents.length})</h2>
        <div className="events-grid">
          {visibleEvents.map((event, index) => {
            const eventIsSpan = isEventSpan(event)
            const startDateDisplay = formatEventDate(event, false)
            const endDateDisplay = formatEventDate(event, true)
            
            return (
              <motion.div
                key={event.id}
                className="event-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.1 * index, 0.5), duration: 0.3 }}
              >
                <div className="event-card-header">
                  <div className="event-badges">
                    <span className={`event-type-badge ${event.date_type === 'astronomical' ? 'astronomical' : 'historical'}`}>
                      {event.date_type === 'astronomical' ? 'Astronomical' : 'Historical'}
                    </span>
                    <span className={`event-type-badge ${eventIsSpan ? 'span' : 'point'}`}>
                      {eventIsSpan ? 'Span' : 'Point'}
                    </span>
                  </div>
                  <h3>{event.title}</h3>
                </div>
                <p className="event-description">{event.description}</p>
                <div className="event-dates">
                  <span>{startDateDisplay}</span>
                  {eventIsSpan && endDateDisplay && (
                    <>
                      <span className="date-arrow">→</span>
                      <span>{endDateDisplay}</span>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.section>
    </div>
  )
}

export default Home
