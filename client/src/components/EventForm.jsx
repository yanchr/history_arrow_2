import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  validateDateRange, 
  validateAstronomicalRange,
  parseAstronomicalInput,
  yearsAgoToFormValues,
  formatYearsAgo,
  ASTRONOMICAL_UNITS
} from '../utils/dateUtils'
import './EventForm.css'

function EventForm({ event, onSubmit, onCancel, error }) {
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date_type: 'date',
    start_date: '',
    end_date: '',
    astronomical_value: '',
    astronomical_unit: 'millions',
    astronomical_end_value: '',
    astronomical_end_unit: 'millions',
    priority: 3 // Default to normal priority
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [isSpan, setIsSpan] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Initialize form when editing an event
  useEffect(() => {
    if (event) {
      const dateType = event.date_type || 'date'
      
      if (dateType === 'astronomical') {
        const startValues = yearsAgoToFormValues(event.astronomical_start_year)
        const endValues = event.astronomical_end_year 
          ? yearsAgoToFormValues(event.astronomical_end_year)
          : { value: '', unit: 'millions' }
        
        setFormData({
          title: event.title || '',
          description: event.description || '',
          date_type: 'astronomical',
          start_date: '',
          end_date: '',
          astronomical_value: startValues.value.toString(),
          astronomical_unit: startValues.unit,
          astronomical_end_value: endValues.value ? endValues.value.toString() : '',
          astronomical_end_unit: endValues.unit,
          priority: event.priority || 3
        })
        setIsSpan(!!event.astronomical_end_year)
      } else {
        setFormData({
          title: event.title || '',
          description: event.description || '',
          date_type: 'date',
          start_date: event.start_date ? event.start_date.split('T')[0] : '',
          end_date: event.end_date ? event.end_date.split('T')[0] : '',
          astronomical_value: '',
          astronomical_unit: 'millions',
          astronomical_end_value: '',
          astronomical_end_unit: 'millions',
          priority: event.priority || 3
        })
        setIsSpan(!!event.end_date)
      }
    }
  }, [event])

  // Calculate displayed years ago for astronomical inputs
  const astronomicalPreview = useMemo(() => {
    if (formData.date_type !== 'astronomical') return null
    
    const startYears = parseAstronomicalInput(formData.astronomical_value, formData.astronomical_unit)
    const endYears = isSpan 
      ? parseAstronomicalInput(formData.astronomical_end_value, formData.astronomical_end_unit)
      : null
    
    return {
      start: startYears ? formatYearsAgo(startYears) : null,
      end: endYears ? formatYearsAgo(endYears) : null
    }
  }, [formData, isSpan])

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

  const handleDateTypeChange = (newType) => {
    setFormData(prev => ({ ...prev, date_type: newType }))
    setValidationErrors({})
    setIsSpan(false)
  }

  const handleSpanToggle = (e) => {
    setIsSpan(e.target.checked)
    if (!e.target.checked) {
      setFormData(prev => ({ 
        ...prev, 
        end_date: '',
        astronomical_end_value: '',
        astronomical_end_unit: 'millions'
      }))
    }
  }

  const validate = () => {
    const errors = {}

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    }

    if (formData.date_type === 'date') {
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
    } else {
      // Astronomical validation
      const startYears = parseAstronomicalInput(formData.astronomical_value, formData.astronomical_unit)
      
      if (!startYears) {
        errors.astronomical_value = 'Please enter a valid number'
      }

      if (isSpan) {
        const endYears = parseAstronomicalInput(formData.astronomical_end_value, formData.astronomical_end_unit)
        
        if (!endYears) {
          errors.astronomical_end_value = 'Please enter a valid number'
        } else {
          const astroValidation = validateAstronomicalRange(startYears, endYears)
          if (!astroValidation.valid) {
            errors.astronomical_end_value = astroValidation.error
          }
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
    
    let submitData

    if (formData.date_type === 'date') {
      submitData = {
        title: formData.title,
        description: formData.description,
        date_type: 'date',
        start_date: formData.start_date,
        end_date: isSpan ? formData.end_date : null,
        astronomical_start_year: null,
        astronomical_end_year: null,
        priority: Number(formData.priority)
      }
    } else {
      const startYears = parseAstronomicalInput(formData.astronomical_value, formData.astronomical_unit)
      const endYears = isSpan 
        ? parseAstronomicalInput(formData.astronomical_end_value, formData.astronomical_end_unit)
        : null

      submitData = {
        title: formData.title,
        description: formData.description,
        date_type: 'astronomical',
        start_date: null,
        end_date: null,
        astronomical_start_year: startYears,
        astronomical_end_year: endYears,
        priority: Number(formData.priority)
      }
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

        {/* Priority Selector */}
        <div className="form-group">
          <label htmlFor="priority" className="form-label">Priority</label>
          <div className="priority-selector">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                className={`priority-btn priority-${level} ${Number(formData.priority) === level ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, priority: level }))}
                disabled={submitting}
              >
                {level === 1 && 'Minor'}
                {level === 2 && 'Low'}
                {level === 3 && 'Normal'}
                {level === 4 && 'High'}
                {level === 5 && 'Major'}
              </button>
            ))}
          </div>
          <p className="form-hint">
            {Number(formData.priority) === 5 && 'Major events always show labels on the timeline'}
            {Number(formData.priority) === 4 && 'High priority events show labels when moderately zoomed'}
            {Number(formData.priority) === 3 && 'Normal events show labels at standard zoom levels'}
            {Number(formData.priority) === 2 && 'Low priority events only show labels when zoomed in'}
            {Number(formData.priority) === 1 && 'Minor events only show labels when fully zoomed in'}
          </p>
        </div>

        {/* Date Type Toggle */}
        <div className="form-group">
          <label className="form-label">Date Type</label>
          <div className="date-type-toggle">
            <button
              type="button"
              className={`date-type-btn ${formData.date_type === 'date' ? 'active' : ''}`}
              onClick={() => handleDateTypeChange('date')}
              disabled={submitting}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Calendar Date
            </button>
            <button
              type="button"
              className={`date-type-btn ${formData.date_type === 'astronomical' ? 'active' : ''}`}
              onClick={() => handleDateTypeChange('astronomical')}
              disabled={submitting}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="21.17" y1="8" x2="12" y2="8" />
                <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
                <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
              </svg>
              Astronomical Year
            </button>
          </div>
          <p className="form-hint">
            {formData.date_type === 'date' 
              ? 'Use for events with precise calendar dates (e.g., battles, inventions)'
              : 'Use for events millions/billions of years ago (e.g., geological eras, evolution)'}
          </p>
        </div>

        {/* Time Span Toggle */}
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
              <span className="toggle-text">
                This is a time span (has start and end {formData.date_type === 'date' ? 'dates' : 'periods'})
              </span>
            </label>
          </div>
        </div>

        {/* Date Inputs */}
        <AnimatePresence mode="wait">
          {formData.date_type === 'date' ? (
            <motion.div
              key="date-inputs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="form-row"
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="astronomical-inputs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Start/Main astronomical input */}
              <div className="form-group">
                <label className="form-label">
                  {isSpan ? 'Started (years ago) *' : 'Years Ago *'}
                </label>
                <div className="astronomical-input-group">
                  <input
                    type="number"
                    name="astronomical_value"
                    className={`form-input ${validationErrors.astronomical_value ? 'error' : ''}`}
                    value={formData.astronomical_value}
                    onChange={handleChange}
                    placeholder="e.g., 4.5"
                    min="0"
                    step="any"
                    disabled={submitting}
                  />
                  <select
                    name="astronomical_unit"
                    className="form-select"
                    value={formData.astronomical_unit}
                    onChange={handleChange}
                    disabled={submitting}
                  >
                    <option value="years">Years</option>
                    <option value="thousands">Thousand years</option>
                    <option value="millions">Million years</option>
                    <option value="billions">Billion years</option>
                  </select>
                </div>
                {validationErrors.astronomical_value && (
                  <span className="form-error">{validationErrors.astronomical_value}</span>
                )}
                {astronomicalPreview?.start && (
                  <span className="form-preview">{astronomicalPreview.start}</span>
                )}
              </div>

              {/* End astronomical input */}
              {isSpan && (
                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <label className="form-label">Ended (years ago) *</label>
                  <div className="astronomical-input-group">
                    <input
                      type="number"
                      name="astronomical_end_value"
                      className={`form-input ${validationErrors.astronomical_end_value ? 'error' : ''}`}
                      value={formData.astronomical_end_value}
                      onChange={handleChange}
                      placeholder="e.g., 4.0"
                      min="0"
                      step="any"
                      disabled={submitting}
                    />
                    <select
                      name="astronomical_end_unit"
                      className="form-select"
                      value={formData.astronomical_end_unit}
                      onChange={handleChange}
                      disabled={submitting}
                    >
                      <option value="years">Years</option>
                      <option value="thousands">Thousand years</option>
                      <option value="millions">Million years</option>
                      <option value="billions">Billion years</option>
                    </select>
                  </div>
                  {validationErrors.astronomical_end_value && (
                    <span className="form-error">{validationErrors.astronomical_end_value}</span>
                  )}
                  {astronomicalPreview?.end && (
                    <span className="form-preview">{astronomicalPreview.end}</span>
                  )}
                  <p className="form-hint">
                    End time should be more recent (smaller number) than start time
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
