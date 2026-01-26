import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEvents } from '../hooks/useEvents'
import EventForm from '../components/EventForm'
import { formatEventDate } from '../utils/dateUtils'
import './Admin.css'

// Helper to check if an event is a span
const isEventSpan = (event) => {
  if (event.date_type === 'astronomical') {
    return !!event.astronomical_end_year
  }
  return !!event.end_date
}

function Admin() {
  const { events, loading, error, createEvent, updateEvent, deleteEvent, refetch } = useEvents()
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const handleCreate = () => {
    setEditingEvent(null)
    setShowForm(true)
    setActionError('')
    setActionSuccess('')
  }

  const handleEdit = (event) => {
    setEditingEvent(event)
    setShowForm(true)
    setActionError('')
    setActionSuccess('')
  }

  const handleDelete = async (event) => {
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return
    }

    try {
      setActionError('')
      await deleteEvent(event.id)
      setActionSuccess(`"${event.title}" has been deleted.`)
      setTimeout(() => setActionSuccess(''), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleFormSubmit = async (formData) => {
    try {
      setActionError('')
      if (editingEvent) {
        await updateEvent(editingEvent.id, formData)
        setActionSuccess(`"${formData.title}" has been updated.`)
      } else {
        await createEvent(formData)
        setActionSuccess(`"${formData.title}" has been created.`)
      }
      setShowForm(false)
      setEditingEvent(null)
      setTimeout(() => setActionSuccess(''), 3000)
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingEvent(null)
    setActionError('')
  }

  return (
    <div className="admin-page">
      <motion.div
        className="admin-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <p>Manage historical events and time spans</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCreate}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Event
        </button>
      </motion.div>

      <AnimatePresence>
        {(actionError || actionSuccess) && (
          <motion.div
            className={`action-message ${actionSuccess ? 'success' : 'error'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {actionError || actionSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.div
            className="form-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleFormCancel}
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
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                error={actionError}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-number">{events.length}</span>
          <span className="stat-label">Total Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{events.filter(e => e.date_type === 'astronomical').length}</span>
          <span className="stat-label">Astronomical</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{events.filter(e => e.date_type === 'date').length}</span>
          <span className="stat-label">Historical</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{events.filter(e => !isEventSpan(e)).length}</span>
          <span className="stat-label">Point Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{events.filter(e => isEventSpan(e)).length}</span>
          <span className="stat-label">Time Spans</span>
        </div>
      </div>

      <motion.div
        className="events-table-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading events...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={refetch}>
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-icon">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
            <h3>No events yet</h3>
            <p>Start by adding your first historical event</p>
            <button className="btn btn-primary" onClick={handleCreate}>
              Add Your First Event
            </button>
          </div>
        ) : (
          <table className="events-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Date Type</th>
                <th>Event Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => {
                const eventIsSpan = isEventSpan(event)
                const startDateDisplay = formatEventDate(event, false)
                const endDateDisplay = formatEventDate(event, true)
                
                return (
                  <motion.tr
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <td>
                      <div className="event-title-cell">
                        <strong>{event.title}</strong>
                        {event.description && (
                          <span className="event-preview">{event.description.substring(0, 60)}...</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`priority-badge priority-${event.priority || 3}`}>
                        {event.priority === 5 && 'Major'}
                        {event.priority === 4 && 'High'}
                        {(event.priority === 3 || !event.priority) && 'Normal'}
                        {event.priority === 2 && 'Low'}
                        {event.priority === 1 && 'Minor'}
                      </span>
                    </td>
                    <td>
                      <span className={`type-badge ${event.date_type === 'astronomical' ? 'astronomical' : 'historical'}`}>
                        {event.date_type === 'astronomical' ? 'Astronomical' : 'Historical'}
                      </span>
                    </td>
                    <td>
                      <span className={`type-badge ${eventIsSpan ? 'span' : 'point'}`}>
                        {eventIsSpan ? 'Span' : 'Point'}
                      </span>
                    </td>
                    <td className="date-cell">{startDateDisplay || '—'}</td>
                    <td className="date-cell">{endDateDisplay || '—'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(event)}
                          title="Edit"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(event)}
                          title="Delete"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}

export default Admin
