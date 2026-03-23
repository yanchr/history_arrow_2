import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  validateDateRange, 
  validateAstronomicalRange,
  parseAstronomicalInput,
  yearsAgoToFormValues,
  formatYearsAgo,
  ASTRONOMICAL_UNITS
} from '../utils/dateUtils'
import { supabase } from '../utils/supabase'
import { withTimeout } from '../utils/asyncTimeout'
import { validateSubEventDates } from '../utils/eventHierarchy'
import './EventForm.css'

const STORAGE_BUCKET = 'event-images'
const REQUEST_TIMEOUT_MS = 15000

function EventForm({ event, onSubmit, onCancel, error, labels = [], parentEvent = null, beforeFormActions = null }) {
  const isSubEventForm = Boolean(parentEvent)
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    source_url: '',
    youtube_url: '',
    attribution_text: '',
    is_published: false,
    license_type: '',
    date_type: 'date',
    start_date: '',
    end_date: '',
    astronomical_value: '',
    astronomical_unit: 'millions',
    astronomical_end_value: '',
    astronomical_end_unit: 'millions',
    label: ''
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [isSpan, setIsSpan] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  // Initialize form: top-level, new sub-event, or edit sub-event
  useEffect(() => {
    if (parentEvent) {
      const dateType = parentEvent.date_type || 'date'
      if (event) {
        if (dateType === 'astronomical') {
          const startValues = yearsAgoToFormValues(event.astronomical_start_year)
          setFormData({
            title: event.title || '',
            description: event.description || '',
            image_url: event.image_url || '',
            source_url: event.source_url || event.event_url || '',
            youtube_url: event.youtube_url || '',
            attribution_text: event.attribution_text || '',
            is_published: Boolean(event.is_published),
            license_type: event.license_type || '',
            date_type: 'astronomical',
            start_date: '',
            end_date: '',
            astronomical_value: startValues.value.toString(),
            astronomical_unit: startValues.unit,
            astronomical_end_value: '',
            astronomical_end_unit: 'millions',
            label: event.label || ''
          })
        } else {
          setFormData({
            title: event.title || '',
            description: event.description || '',
            image_url: event.image_url || '',
            source_url: event.source_url || event.event_url || '',
            youtube_url: event.youtube_url || '',
            attribution_text: event.attribution_text || '',
            is_published: Boolean(event.is_published),
            license_type: event.license_type || '',
            date_type: 'date',
            start_date: event.start_date ? event.start_date.split('T')[0] : '',
            end_date: '',
            astronomical_value: '',
            astronomical_unit: 'millions',
            astronomical_end_value: '',
            astronomical_end_unit: 'millions',
            label: event.label || ''
          })
        }
        setIsSpan(false)
        return
      }

      if (dateType === 'astronomical') {
        const pStart = parentEvent.astronomical_start_year
        const pEnd = parentEvent.astronomical_end_year ?? pStart
        const mid = Math.round((Number(pStart) + Number(pEnd)) / 2)
        const startValues = yearsAgoToFormValues(mid)
        setFormData({
          title: '',
          description: '',
          image_url: '',
          source_url: '',
          youtube_url: '',
          attribution_text: '',
          is_published: Boolean(parentEvent.is_published),
          license_type: parentEvent.license_type || '',
          date_type: 'astronomical',
          start_date: '',
          end_date: '',
          astronomical_value: startValues.value.toString(),
          astronomical_unit: startValues.unit,
          astronomical_end_value: '',
          astronomical_end_unit: 'millions',
          label: parentEvent.label || ''
        })
      } else {
        setFormData({
          title: '',
          description: '',
          image_url: '',
          source_url: '',
          youtube_url: '',
          attribution_text: '',
          is_published: Boolean(parentEvent.is_published),
          license_type: parentEvent.license_type || '',
          date_type: 'date',
          start_date: parentEvent.start_date ? parentEvent.start_date.split('T')[0] : '',
          end_date: '',
          astronomical_value: '',
          astronomical_unit: 'millions',
          astronomical_end_value: '',
          astronomical_end_unit: 'millions',
          label: parentEvent.label || ''
        })
      }
      setIsSpan(false)
      return
    }

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
          image_url: event.image_url || '',
          source_url: event.source_url || event.event_url || '',
          youtube_url: event.youtube_url || '',
          attribution_text: event.attribution_text || '',
          is_published: Boolean(event.is_published),
          license_type: event.license_type || '',
          date_type: 'astronomical',
          start_date: '',
          end_date: '',
          astronomical_value: startValues.value.toString(),
          astronomical_unit: startValues.unit,
          astronomical_end_value: endValues.value ? endValues.value.toString() : '',
          astronomical_end_unit: endValues.unit,
          label: event.label || ''
        })
        setIsSpan(!!event.astronomical_end_year)
      } else {
        setFormData({
          title: event.title || '',
          description: event.description || '',
          image_url: event.image_url || '',
          source_url: event.source_url || event.event_url || '',
          youtube_url: event.youtube_url || '',
          attribution_text: event.attribution_text || '',
          is_published: Boolean(event.is_published),
          license_type: event.license_type || '',
          date_type: 'date',
          start_date: event.start_date ? event.start_date.split('T')[0] : '',
          end_date: event.end_date ? event.end_date.split('T')[0] : '',
          astronomical_value: '',
          astronomical_unit: 'millions',
          astronomical_end_value: '',
          astronomical_end_unit: 'millions',
          label: event.label || ''
        })
        setIsSpan(!!event.end_date)
      }
    }
  }, [event, parentEvent])

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
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPEG, PNG, GIF, WebP)')
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        setUploadError('Supabase is not configured. Use the URL field to paste an image link.')
        return
      }
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await withTimeout(
        supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false
        }),
        REQUEST_TIMEOUT_MS,
        'Upload timed out. Check local network or Supabase status and try again.'
      )
      if (error) throw error
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
      setFormData(prev => ({ ...prev, image_url: data.publicUrl }))
    } catch (err) {
      const msg = err.message || 'Upload failed'
      const isRlsError = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')
      setUploadError(isRlsError
        ? 'Storage policy not configured. Run supabase-storage-policies.sql in Supabase SQL Editor, or paste an image URL instead.'
        : msg)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image_url: '' }))
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validate = () => {
    const errors = {}
    const effectiveSpan = isSubEventForm ? false : isSpan

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    }

    if (formData.date_type === 'date') {
      if (!formData.start_date) {
        errors.start_date = 'Start date is required'
      }

      if (effectiveSpan) {
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

      if (effectiveSpan) {
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

    if (parentEvent) {
      if (formData.date_type === 'date') {
        const subCheck = validateSubEventDates(parentEvent, {
          date_type: 'date',
          start_date: formData.start_date,
          end_date: null
        })
        if (!subCheck.valid) errors.start_date = subCheck.error
      } else {
        const startYears = parseAstronomicalInput(formData.astronomical_value, formData.astronomical_unit)
        const subCheck = validateSubEventDates(parentEvent, {
          date_type: 'astronomical',
          astronomical_start_year: startYears,
          astronomical_end_year: null
        })
        if (!subCheck.valid) errors.astronomical_value = subCheck.error
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
    const effectiveSpan = isSubEventForm ? false : isSpan

    if (formData.date_type === 'date') {
      submitData = {
        title: formData.title,
        description: formData.description,
        image_url: formData.image_url?.trim() || null,
        source_url: formData.source_url?.trim() || null,
        youtube_url: formData.youtube_url?.trim() || null,
        attribution_text: formData.attribution_text?.trim() || null,
        is_published: Boolean(formData.is_published),
        license_type: formData.license_type?.trim() || null,
        date_type: 'date',
        start_date: formData.start_date,
        end_date: effectiveSpan ? formData.end_date : null,
        astronomical_start_year: null,
        astronomical_end_year: null,
        label: formData.label || null,
        parent_id: parentEvent ? parentEvent.id : null
      }
    } else {
      const startYears = parseAstronomicalInput(formData.astronomical_value, formData.astronomical_unit)
      const endYears = effectiveSpan 
        ? parseAstronomicalInput(formData.astronomical_end_value, formData.astronomical_end_unit)
        : null

      submitData = {
        title: formData.title,
        description: formData.description,
        image_url: formData.image_url?.trim() || null,
        source_url: formData.source_url?.trim() || null,
        youtube_url: formData.youtube_url?.trim() || null,
        attribution_text: formData.attribution_text?.trim() || null,
        is_published: Boolean(formData.is_published),
        license_type: formData.license_type?.trim() || null,
        date_type: 'astronomical',
        start_date: null,
        end_date: null,
        astronomical_start_year: startYears,
        astronomical_end_year: endYears,
        label: formData.label || null,
        parent_id: parentEvent ? parentEvent.id : null
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
        <h2>
          {parentEvent
            ? (event ? 'Edit sub-event' : 'Add sub-event')
            : (event ? 'Edit Event' : 'Add New Event')}
        </h2>
        <p>
          {parentEvent
            ? `Moment within “${parentEvent.title}” (${parentEvent.date_type === 'astronomical' ? 'astronomical' : 'calendar'})`
            : (event ? 'Update the details below' : 'Fill in the details to create a new historical event')}
        </p>
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

        {/* Label Selector */}
        <div className="form-group">
          <label htmlFor="label" className="form-label">Label</label>
          <div className="label-selector">
            <button
              type="button"
              className={`label-btn ${!formData.label ? 'active' : ''}`}
              onClick={() => setFormData(prev => ({ ...prev, label: '' }))}
              disabled={submitting}
              style={!formData.label ? { borderColor: '#6b7280', background: 'rgba(107, 114, 128, 0.2)' } : {}}
            >
              None
            </button>
            {labels.map((l) => (
              <button
                key={l.name}
                type="button"
                className={`label-btn ${formData.label === l.name ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, label: l.name }))}
                disabled={submitting}
                style={formData.label === l.name ? { borderColor: l.color, background: `${l.color}20`, color: l.color } : {}}
              >
                {l.name}
              </button>
            ))}
          </div>
          <p className="form-hint">Categorize this event for filtering on the timeline</p>
        </div>

        {/* Date Type Toggle */}
        {!isSubEventForm && (
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
        )}

        {/* Time Span Toggle */}
        {!isSubEventForm && (
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
        )}

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
                  {isSubEventForm ? 'Moment (years ago) *' : isSpan ? 'Started (years ago) *' : 'Years Ago *'}
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

        <div className="form-group">
          <label htmlFor="source_url" className="form-label">Source URL</label>
          <input
            id="source_url"
            name="source_url"
            type="url"
            className="form-input"
            value={formData.source_url}
            onChange={handleChange}
            placeholder="https://example.com/source-article"
            disabled={submitting}
          />
          <p className="form-hint">Optional citation or reference link for this event.</p>
        </div>

        <div className="form-group">
          <label htmlFor="youtube_url" className="form-label">YouTube URL</label>
          <input
            id="youtube_url"
            name="youtube_url"
            type="url"
            className="form-input"
            value={formData.youtube_url}
            onChange={handleChange}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={submitting}
          />
          <p className="form-hint">Optional YouTube link shown in event details.</p>
        </div>

        {/* Picture */}
        <div className="form-group">
          <label className="form-label">Picture</label>
          {formData.image_url ? (
            <div className="image-preview-container">
              <img
                src={formData.image_url}
                alt="Preview"
                className="image-preview"
              />
              <div className="image-preview-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRemoveImage}
                  disabled={submitting}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="image-upload-options">
              <div className="image-url-input">
                <input
                  id="image_url"
                  name="image_url"
                  type="url"
                  className="form-input"
                  value={formData.image_url}
                  onChange={handleChange}
                  placeholder="Paste image URL..."
                  disabled={submitting}
                />
              </div>
              <div className="image-upload-divider">or</div>
              <div className="image-file-upload">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={submitting || uploading}
                  className="image-file-input"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting || uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload image'}
                </button>
              </div>
            </div>
          )}
          {uploadError && (
            <span className="form-error">{uploadError}</span>
          )}
          <p className="form-hint">
            Add an optional image. Paste a URL or upload to Supabase Storage (requires event-images bucket).
          </p>
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
          <label htmlFor="attribution_text" className="form-label">Attribution Text</label>
          <textarea
            id="attribution_text"
            name="attribution_text"
            className="form-textarea"
            value={formData.attribution_text}
            onChange={handleChange}
            placeholder="Photo by Author Name (CC BY 4.0) via Example Source"
            rows={2}
            disabled={submitting}
          />
          <p className="form-hint">Shown publicly as a source/credit line when available.</p>
        </div>

        <div className="form-group">
          <label htmlFor="license_type" className="form-label">License Type</label>
          <input
            id="license_type"
            name="license_type"
            type="text"
            className="form-input"
            value={formData.license_type}
            onChange={handleChange}
            placeholder="e.g., CC BY 4.0, Public Domain, Proprietary"
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Publishing</label>
          <div className="rights-toggle-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                name="is_published"
                checked={formData.is_published}
                onChange={handleChange}
                disabled={submitting}
              />
              <span className="toggle-switch" />
              <span className="toggle-text">Published (visible to public)</span>
            </label>
          </div>
        </div>

        {beforeFormActions}

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
