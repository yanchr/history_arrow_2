import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEvents } from '../hooks/useEvents'
import { useLabels } from '../hooks/useLabels'
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

// Helper to get a sortable date value from an event
// Returns "years ago" value - larger numbers = older events
// This allows proper comparison between astronomical and calendar dates
const getEventSortValue = (event) => {
  const currentYear = new Date().getFullYear()
  
  if (event.date_type === 'astronomical') {
    // Astronomical years are stored as "years ago", so use directly
    // These are typically millions/billions of years ago
    return event.astronomical_start_year || 0
  }
  
  // For calendar dates, convert to "years ago" format
  if (event.start_date) {
    const eventDate = new Date(event.start_date)
    const eventYear = eventDate.getFullYear()
    // Calculate years ago (can be negative for future dates, positive for past)
    // Add fractional year for more precise sorting within the same year
    const dayOfYear = (eventDate - new Date(eventYear, 0, 0)) / (1000 * 60 * 60 * 24)
    const yearsAgo = currentYear - eventYear + (1 - dayOfYear / 365)
    return Math.max(0, yearsAgo) // Ensure non-negative
  }
  
  return 0
}

function Admin() {
  const { events, loading, error, createEvent, updateEvent, deleteEvent, refetch } = useEvents()
  const { labels, createLabel, updateLabel, deleteLabel, labelColorMap } = useLabels()
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showLabelForm, setShowLabelForm] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#6b7280')
  const [labelError, setLabelError] = useState('')
  const [editingLabel, setEditingLabel] = useState(null)
  const [editLabelName, setEditLabelName] = useState('')
  const [editLabelColor, setEditLabelColor] = useState('')

  // Filter events based on search query
  const filteredEvents = events.filter(event => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      event.title?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query)
    )
  })

  // Sort filtered events by start date
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const valueA = getEventSortValue(a)
    const valueB = getEventSortValue(b)
    // For 'desc' (newest first): smaller sort values should come first
    // For 'asc' (oldest first): larger sort values should come first
    return sortOrder === 'desc' ? valueA - valueB : valueB - valueA
  })

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  }

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
                labels={labels}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="search-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="search-input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search events by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && (
          <span className="search-results-count">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'result' : 'results'} found
          </span>
        )}
      </motion.div>

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

      {/* Label Management */}
      <motion.div
        className="label-management"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="label-management-header">
          <h2>Labels</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowLabelForm(!showLabelForm); setLabelError('') }}
          >
            {showLabelForm ? 'Cancel' : '+ Add Label'}
          </button>
        </div>

        {labelError && (
          <div className="action-message error" style={{ marginBottom: '0.75rem' }}>{labelError}</div>
        )}

        <AnimatePresence>
          {showLabelForm && (
            <motion.div
              className="label-add-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                type="text"
                className="form-input"
                placeholder="Label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
              />
              <input
                type="color"
                className="color-picker"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  try {
                    setLabelError('')
                    await createLabel(newLabelName, newLabelColor)
                    setNewLabelName('')
                    setNewLabelColor('#6b7280')
                    setShowLabelForm(false)
                  } catch (err) {
                    setLabelError(err.message)
                  }
                }}
                disabled={!newLabelName.trim()}
              >
                Save
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="label-chips">
          {labels.map((label) => {
            const eventCount = events.filter(e => e.label === label.name).length
            const isEditing = editingLabel === label.id

            if (isEditing) {
              return (
                <div
                  key={label.id}
                  className="label-chip label-chip--editing"
                  style={{ borderColor: editLabelColor, background: `${editLabelColor}15` }}
                >
                  <input
                    type="color"
                    className="label-edit-color"
                    value={editLabelColor}
                    onChange={(e) => setEditLabelColor(e.target.value)}
                  />
                  <input
                    type="text"
                    className="label-edit-name"
                    value={editLabelName}
                    onChange={(e) => setEditLabelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.closest('.label-chip').querySelector('.label-edit-save').click()
                      if (e.key === 'Escape') setEditingLabel(null)
                    }}
                    autoFocus
                  />
                  <button
                    className="label-edit-save"
                    title="Save"
                    onClick={async () => {
                      try {
                        setLabelError('')
                        await updateLabel(label.id, { name: editLabelName, color: editLabelColor })
                        await refetch()
                        setEditingLabel(null)
                      } catch (err) {
                        setLabelError(err.message)
                      }
                    }}
                    disabled={!editLabelName.trim()}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <button
                    className="label-edit-cancel"
                    title="Cancel"
                    onClick={() => setEditingLabel(null)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            }

            return (
              <div
                key={label.id}
                className="label-chip label-chip--clickable"
                style={{ borderColor: label.color, background: `${label.color}15` }}
                onClick={() => {
                  setEditingLabel(label.id)
                  setEditLabelName(label.name)
                  setEditLabelColor(label.color)
                  setLabelError('')
                }}
              >
                <span className="label-chip-dot" style={{ backgroundColor: label.color }} />
                <span className="label-chip-name">{label.name}</span>
                <span className="label-chip-count">{eventCount}</span>
                <button
                  className="label-chip-delete"
                  title={`Delete "${label.name}" label`}
                  onClick={async (e) => {
                    e.stopPropagation()
                    const msg = eventCount > 0
                      ? `This will remove the label from ${eventCount} event(s). Continue?`
                      : `Delete the "${label.name}" label?`
                    if (!window.confirm(msg)) return
                    try {
                      setLabelError('')
                      await deleteLabel(label.id)
                      await refetch()
                    } catch (err) {
                      setLabelError(err.message)
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
          {labels.length === 0 && (
            <span className="label-chips-empty">No labels yet. Add one above.</span>
          )}
        </div>
      </motion.div>

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
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-icon">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <h3>No matching events</h3>
            <p>Try adjusting your search terms</p>
            <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
              Clear Search
            </button>
          </div>
        ) : (
          <table className="events-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Label</th>
                <th>Date Type</th>
                <th>Event Type</th>
                <th className="sortable-header" onClick={toggleSortOrder}>
                  <span className="header-content">
                    Start
                    <span className={`sort-indicator ${sortOrder}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {sortOrder === 'desc' ? (
                          <path d="M12 5v14M5 12l7 7 7-7" />
                        ) : (
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        )}
                      </svg>
                    </span>
                  </span>
                </th>
                <th>End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((event, index) => {
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
                      {event.label ? (
                        <span
                          className="label-badge"
                          style={{
                            background: `${labelColorMap.get(event.label) || '#6b7280'}20`,
                            color: labelColorMap.get(event.label) || '#6b7280'
                          }}
                        >
                          {event.label}
                        </span>
                      ) : (
                        <span className="label-badge label-none">None</span>
                      )}
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
