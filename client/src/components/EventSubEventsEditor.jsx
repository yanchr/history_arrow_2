import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import EventForm from './EventForm'
import { formatEventDate } from '../utils/dateUtils'
import { getSubEventsForParent } from '../utils/eventHierarchy'
import './EventSubEventsEditor.css'

function isEventSpan(event) {
  if (!event) return false
  if (event.date_type === 'astronomical') {
    return !!event.astronomical_end_year
  }
  return !!event.end_date
}

/**
 * Sub-events list + nested sub-event form. Render inside the main edit modal when
 * `parentEvent` is a top-level time span (shared by Admin and Home).
 */
function EventSubEventsEditor({
  parentEvent,
  allEvents = [],
  labels = [],
  createEvent,
  updateEvent,
  deleteEvent,
  onAfterMutation
}) {
  const [showSubForm, setShowSubForm] = useState(false)
  const [editingSubEvent, setEditingSubEvent] = useState(null)
  const [subFormError, setSubFormError] = useState('')

  if (!parentEvent || !isEventSpan(parentEvent) || parentEvent.parent_id) {
    return null
  }

  const subs = getSubEventsForParent(allEvents, parentEvent.id)

  const handleSubFormSubmit = async (formData) => {
    try {
      setSubFormError('')
      if (editingSubEvent) {
        await updateEvent(editingSubEvent.id, formData)
      } else {
        await createEvent(formData)
      }
      if (onAfterMutation) await onAfterMutation()
      setShowSubForm(false)
      setEditingSubEvent(null)
    } catch (err) {
      setSubFormError(err.message)
    }
  }

  const handleSubFormCancel = () => {
    setShowSubForm(false)
    setEditingSubEvent(null)
    setSubFormError('')
  }

  const openNewSubEvent = () => {
    setEditingSubEvent(null)
    setSubFormError('')
    setShowSubForm(true)
  }

  const openEditSubEvent = (sub) => {
    setEditingSubEvent(sub)
    setSubFormError('')
    setShowSubForm(true)
  }

  const handleDeleteSub = async (sub) => {
    if (!window.confirm(`Delete sub-event “${sub.title}”?`)) return
    try {
      await deleteEvent(sub.id)
      if (onAfterMutation) await onAfterMutation()
    } catch (err) {
      window.alert(err.message)
    }
  }

  const subFormModal = showSubForm ? (
    <AnimatePresence>
      <motion.div
        className="form-overlay form-overlay--sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleSubFormCancel}
      >
        <motion.div
          className="form-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <EventForm
            parentEvent={parentEvent}
            event={editingSubEvent}
            onSubmit={handleSubFormSubmit}
            onCancel={handleSubFormCancel}
            error={subFormError}
            labels={labels}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ) : null

  return (
    <>
      <div className="event-sub-events-panel">
        <div className="event-sub-events-header">
          <h3 className="event-sub-events-title">Sub-events</h3>
          <p className="event-sub-events-hint">
            Point-in-time moments along this span. They appear on long hover on the timeline and in the detail view.
          </p>
        </div>
        <div className="event-sub-events-body">
          {subs.length === 0 ? (
            <p className="event-sub-events-empty">No sub-events yet.</p>
          ) : (
            <ul className="event-sub-events-list">
              {subs.map((sub) => (
                <li key={sub.id} className="event-sub-events-item">
                  <div className="event-sub-events-item-main">
                    <strong>{sub.title}</strong>
                    <span className="event-sub-events-date">{formatEventDate(sub, false)}</span>
                  </div>
                  <div className="event-sub-events-item-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditSubEvent(sub)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteSub(sub)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="event-sub-events-footer">
          <button type="button" className="event-sub-events-add-btn" onClick={openNewSubEvent}>
            add sub-events
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && subFormModal
        ? createPortal(subFormModal, document.body)
        : null}
    </>
  )
}

export default EventSubEventsEditor
