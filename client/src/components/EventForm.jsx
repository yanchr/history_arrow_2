import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { validateDateRange } from '../utils/dateUtils'
import './EventForm.css'

function EventForm({ event, onSubmit, onCancel, error }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: ''
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [isSpan, setIsSpan] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        start_date: event.start_date ? event.start_date.split('T')[0] : '',
        end_date: event.end_date ? event.end_date.split('T')[0] : ''
      })
      setIsSpan(!!event.end_date)
    }
  }, [event])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSpanToggle = (e) => {
    setIsSpan(e.target.checked)
    if (!e.target.checked) {
      setFormData(prev => ({ ...prev, end_date: '' }))
    }
  }

  const validate = () => {
    const errors = {}

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    }

    if (!formData.start_date) {
      errors.start_date = 'Start date is required'
    }

    if (isSpan) {
      if (!formData.end_date) {
        errors.end_date = 'End date is required for time spans'
      } else {
        const dateValidation = validateDateRange(formData.start_date, formData.end_date)
        if (!dateValidation.valid) {
          errors.end_date = dateValidation.error
        }
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validate()) {
      return
    }

    setSubmitting(true)
    
    const submitData = {
      ...formData,
      end_date: isSpan ? formData.end_date : null
    }

    try {
      await onSubmit(submitData)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="event-form">
      <div className="form-header">
        <h2>{event ? 'Edit Event' : 'Add New Event'}</h2>
        <p>{event ? 'Update the details below' : 'Fill in the details to create a new historical event'}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <motion.div
            className="form-error-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        <div className="form-group">
          <label htmlFor="title" className="form-label">Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            className={`form-input ${validationErrors.title ? 'error' : ''}`}
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Invention of the Lightbulb"
            disabled={submitting}
          />
          {validationErrors.title && (
            <span className="form-error">{validationErrors.title}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">Description</label>
          <textarea
            id="description"
            name="description"
            className="form-textarea"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe this historical event..."
            rows={4}
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <div className="span-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isSpan}
                onChange={handleSpanToggle}
                disabled={submitting}
              />
              <span className="toggle-switch" />
              <span className="toggle-text">This is a time span (has start and end dates)</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start_date" className="form-label">
              {isSpan ? 'Start Date *' : 'Date *'}
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              className={`form-input ${validationErrors.start_date ? 'error' : ''}`}
              value={formData.start_date}
              onChange={handleChange}
              disabled={submitting}
            />
            {validationErrors.start_date && (
              <span className="form-error">{validationErrors.start_date}</span>
            )}
          </div>

          {isSpan && (
            <motion.div
              className="form-group"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <label htmlFor="end_date" className="form-label">End Date *</label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                className={`form-input ${validationErrors.end_date ? 'error' : ''}`}
                value={formData.end_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {validationErrors.end_date && (
                <span className="form-error">{validationErrors.end_date}</span>
              )}
            </motion.div>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EventForm
