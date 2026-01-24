import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import HistoryArrow from '../components/HistoryArrow'
import { useEvents } from '../hooks/useEvents'
import './Home.css'

// Sample events for demonstration
const sampleEvents = [
  {
    id: 1,
    title: 'Hadean Eon',
    description: 'The earliest eon in Earth\'s history, characterized by the formation of the planet and heavy bombardment by asteroids and comets.',
    start_date: '-4600000000-01-01',
    end_date: '-4000000000-01-01'
  },
  {
    id: 2,
    title: 'Invention of the Lightbulb',
    description: 'Thomas Edison successfully demonstrated his incandescent light bulb, revolutionizing the way humans illuminate their world.',
    start_date: '1879-10-21',
    end_date: null
  },
  {
    id: 3,
    title: 'World War II',
    description: 'A global conflict that lasted from 1939 to 1945, involving most of the world\'s nations divided into two opposing military alliances.',
    start_date: '1939-09-01',
    end_date: '1945-09-02'
  },
  {
    id: 4,
    title: 'Moon Landing',
    description: 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon.',
    start_date: '1969-07-20',
    end_date: null
  },
  {
    id: 5,
    title: 'Renaissance Period',
    description: 'A cultural movement that began in Italy and spread throughout Europe, marking the transition from the medieval period to modernity.',
    start_date: '1400-01-01',
    end_date: '1600-01-01'
  },
  {
    id: 6,
    title: 'Industrial Revolution',
    description: 'The transition to new manufacturing processes in Britain and later worldwide, fundamentally changing economy and society.',
    start_date: '1760-01-01',
    end_date: '1840-01-01'
  }
]

function Home() {
  const { events, loading, error } = useEvents()
  const [displayEvents, setDisplayEvents] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')

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
    if (activeFilter === 'points') return !event.end_date
    if (activeFilter === 'spans') return !!event.end_date
    return true
  })

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
          Hover over events to discover their stories.
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
          <HistoryArrow events={filteredEvents} />
        )}
      </motion.section>

      <motion.section
        className="events-list-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <h2>Timeline Events</h2>
        <div className="events-grid">
          {filteredEvents.map((event, index) => (
            <motion.div
              key={event.id}
              className="event-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.3 }}
            >
              <div className="event-card-header">
                <span className={`event-type-badge ${event.end_date ? 'span' : 'point'}`}>
                  {event.end_date ? 'Span' : 'Point'}
                </span>
                <h3>{event.title}</h3>
              </div>
              <p className="event-description">{event.description}</p>
              <div className="event-dates">
                <span>{new Date(event.start_date).getFullYear()}</span>
                {event.end_date && (
                  <>
                    <span className="date-arrow">→</span>
                    <span>{new Date(event.end_date).getFullYear()}</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  )
}

export default Home
