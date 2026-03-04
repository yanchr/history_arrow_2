import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HistoryArrow from '../components/HistoryArrow'
import SelectedEventDetail from '../components/SelectedEventDetail'
import { useEvents } from '../hooks/useEvents'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useLabels'
import { useSeo } from '../hooks/useSeo'
import EventForm from '../components/EventForm'
import { formatEventDate } from '../utils/dateUtils'
import { sampleEvents } from '../data/sampleEvents'
import './Home.css'

// Helper to check if an event is a span
const isEventSpan = (event) => {
  if (event.date_type === 'astronomical') {
    return !!event.astronomical_end_year
  }
  return !!event.end_date
}

function Home() {
  useSeo({
    title: 'Interactive Timeline of Historical Events',
    description: 'Explore world history on an interactive timeline. Discover point events and time spans across ancient, historical, and modern eras.',
    path: '/'
  })

  const { events, loading, error, updateEvent } = useEvents()
  const { isAuthenticated } = useAuth()
  const { labels, labelColorMap } = useLabels()
  const [displayEvents, setDisplayEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [visibleEvents, setVisibleEvents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeLabels, setActiveLabels] = useState([])
  const [filterMode, setFilterMode] = useState('include')
  const [editingEvent, setEditingEvent] = useState(null)
  const [editError, setEditError] = useState('')
  const timelineRef = useRef(null)

  // Handle event click to select/deselect
  const handleEventClick = (event) => {
    setSelectedEvent(prev => prev?.id === event.id ? null : event)
  }

  // Handle click from event card — select + center timeline
  const handleEventCardClick = useCallback((event) => {
    const isDeselecting = selectedEvent?.id === event.id
    setSelectedEvent(isDeselecting ? null : event)
    if (!isDeselecting) {
      timelineRef.current?.centerOnEvent(event)
    }
  }, [selectedEvent])

  // Close selected event detail
  const handleCloseSelectedEvent = () => {
    setSelectedEvent(null)
  }

  const handleEditEvent = useCallback((event) => {
    setEditingEvent(event)
    setEditError('')
  }, [])

  const handleEditSubmit = async (formData) => {
    try {
      setEditError('')
      const updated = await updateEvent(editingEvent.id, formData)
      setEditingEvent(null)
      if (selectedEvent?.id === updated.id) {
        setSelectedEvent(updated)
      }
    } catch (err) {
      setEditError(err.message)
    }
  }

  const handleEditCancel = () => {
    setEditingEvent(null)
    setEditError('')
  }

  // Handle visible events change from timeline
  const handleVisibleEventsChange = (events) => {
    // Sort by yearsAgo descending (oldest first = highest yearsAgo first)
    const sorted = [...events].sort((a, b) => b.yearsAgo - a.yearsAgo)
    setVisibleEvents(sorted)
  }

  const toggleLabel = useCallback((label) => {
    setActiveLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }, [])

  useEffect(() => {
    if (events && events.length > 0) {
      setDisplayEvents(events)
    } else if (!loading) {
      setDisplayEvents(sampleEvents)
    }
  }, [events, loading])

  const filteredEvents = useMemo(() => {
    if (activeLabels.length === 0) return displayEvents
    if (filterMode === 'include') {
      return displayEvents.filter(e => {
        if (!e.label && activeLabels.includes('__none__')) return true
        return e.label && activeLabels.includes(e.label)
      })
    }
    return displayEvents.filter(e => {
      if (!e.label && activeLabels.includes('__none__')) return false
      if (e.label && activeLabels.includes(e.label)) return false
      return true
    })
  }, [displayEvents, activeLabels, filterMode])

  const searchFilteredEvents = useMemo(() => {
    const base = filteredEvents
    if (!searchQuery.trim()) return base
    const query = searchQuery.toLowerCase()
    return base.filter(event =>
      event.title.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query))
    )
  }, [filteredEvents, searchQuery])

  return (
    <div className="home-page">
      <h1 className="visually-hidden">History Arrow Timeline Explorer</h1>
      <div className="label-filter-bar">
        <div className="filter-mode-toggle">
          <button
            className={`filter-mode-btn ${filterMode === 'include' ? 'active' : ''}`}
            onClick={() => setFilterMode('include')}
          >
            Include
          </button>
          <button
            className={`filter-mode-btn ${filterMode === 'exclude' ? 'active' : ''}`}
            onClick={() => setFilterMode('exclude')}
          >
            Exclude
          </button>
        </div>
        <button
          className={`label-filter-chip ${activeLabels.includes('__none__') ? 'active' : ''}`}
          style={activeLabels.includes('__none__') ? { borderColor: '#6b7280', background: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' } : {}}
          onClick={() => toggleLabel('__none__')}
        >
          None
        </button>
        {labels.map((l) => {
          const isActive = activeLabels.includes(l.name)
          return (
            <button
              key={l.name}
              className={`label-filter-chip ${isActive ? 'active' : ''}`}
              style={isActive ? { borderColor: l.color, background: `${l.color}20`, color: l.color } : {}}
              onClick={() => toggleLabel(l.name)}
            >
              {l.name}
            </button>
          )
        })}
        {activeLabels.length > 0 && (
          <button
            className="label-filter-chip"
            onClick={() => setActiveLabels([])}
            style={{ fontStyle: 'italic', opacity: 0.7 }}
          >
            Clear
          </button>
        )}
      </div>

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
            ref={timelineRef}
            events={filteredEvents} 
            selectedEvent={selectedEvent}
            onEventClick={handleEventClick}
            onVisibleEventsChange={handleVisibleEventsChange}
            labelColorMap={labelColorMap}
            titleHint="Hover over events to preview, or click to view details."
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
              onEdit={isAuthenticated ? handleEditEvent : undefined}
            />
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEvent && (
          <motion.div
            className="form-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleEditCancel}
          >
            <motion.div
              className="form-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <EventForm
                event={editingEvent}
                onSubmit={handleEditSubmit}
                onCancel={handleEditCancel}
                error={editError}
                labels={labels}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section
        className="events-list-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <h2>All Events ({searchFilteredEvents.length})</h2>
        <div className="search-bar-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="events-grid">
          {searchFilteredEvents.map((event, index) => {
            const eventIsSpan = isEventSpan(event)
            const startDateDisplay = formatEventDate(event, false)
            const endDateDisplay = formatEventDate(event, true)
            
            return (
              <motion.div
                key={event.id}
                className={`event-card ${selectedEvent?.id === event.id ? 'event-card--selected' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.1 * index, 0.5), duration: 0.3 }}
                onClick={() => handleEventCardClick(event)}
              >
                <div className="event-card-header">
                  <div className="event-badges">
                    <span className={`event-type-badge ${event.date_type === 'astronomical' ? 'astronomical' : 'historical'}`}>
                      {event.date_type === 'astronomical' ? 'Astronomical' : 'Historical'}
                    </span>
                    <span className={`event-type-badge ${eventIsSpan ? 'span' : 'point'}`}>
                      {eventIsSpan ? 'Span' : 'Point'}
                    </span>
                    {event.label && (() => {
                      const color = labelColorMap.get(event.label)
                      return color ? (
                        <span
                          className="event-label-badge"
                          style={{ background: `${color}20`, color }}
                        >
                          {event.label}
                        </span>
                      ) : (
                        <span className="event-label-badge">{event.label}</span>
                      )
                    })()}
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
