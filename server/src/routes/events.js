import express from 'express'
import { supabase, isSupabaseConfigured } from '../config/supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

// Mock data for when Supabase is not configured
let mockEvents = [
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
    label: 'nature',
    image_url: null,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Hadean Eon',
    description: 'The earliest eon in Earth\'s history, characterized by the formation of the planet.',
    date_type: 'astronomical',
    start_date: null,
    end_date: null,
    astronomical_start_year: 4600000000,
    astronomical_end_year: 4000000000,
    label: 'nature',
    image_url: null,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    title: 'Cambrian Explosion',
    description: 'A period of rapid evolutionary diversification when most major animal phyla appeared.',
    date_type: 'astronomical',
    start_date: null,
    end_date: null,
    astronomical_start_year: 538000000,
    astronomical_end_year: 485000000,
    label: 'nature',
    image_url: null,
    created_at: new Date().toISOString()
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
    label: 'nature',
    image_url: null,
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    title: 'Invention of the Lightbulb',
    description: 'Thomas Edison demonstrated his incandescent light bulb.',
    date_type: 'date',
    start_date: '1879-10-21',
    end_date: null,
    astronomical_start_year: null,
    astronomical_end_year: null,
    label: 'discovery',
    image_url: null,
    created_at: new Date().toISOString()
  },
  {
    id: 6,
    title: 'World War II',
    description: 'A global conflict lasting from 1939 to 1945.',
    date_type: 'date',
    start_date: '1939-09-01',
    end_date: '1945-09-02',
    astronomical_start_year: null,
    astronomical_end_year: null,
    label: 'war',
    image_url: null,
    created_at: new Date().toISOString()
  },
  {
    id: 7,
    title: 'Moon Landing',
    description: 'Apollo 11 astronauts became the first humans to walk on the Moon.',
    date_type: 'date',
    start_date: '1969-07-20',
    end_date: null,
    astronomical_start_year: null,
    astronomical_end_year: null,
    label: 'discovery',
    image_url: null,
    created_at: new Date().toISOString()
  }
]
let mockIdCounter = 8

// Validation helper for event data
function validateEventData(body, isUpdate = false) {
  const { 
    title, 
    date_type = 'date', 
    start_date, 
    end_date, 
    astronomical_start_year, 
    astronomical_end_year
  } = body

  if (!title || !title.trim()) {
    return { valid: false, error: 'Title is required' }
  }

  // Validate based on date_type
  if (date_type === 'date') {
    if (!start_date) {
      return { valid: false, error: 'Start date is required for date-type events' }
    }
    if (end_date) {
      const start = new Date(start_date)
      const end = new Date(end_date)
      if (start >= end) {
        return { valid: false, error: 'End date must be after start date' }
      }
    }
  } else if (date_type === 'astronomical') {
    if (!astronomical_start_year || astronomical_start_year <= 0) {
      return { valid: false, error: 'Astronomical start year must be a positive number (years ago)' }
    }
    if (astronomical_end_year !== null && astronomical_end_year !== undefined) {
      if (astronomical_end_year <= 0) {
        return { valid: false, error: 'Astronomical end year must be a positive number (years ago)' }
      }
      if (astronomical_start_year <= astronomical_end_year) {
        return { valid: false, error: 'Astronomical start year must be greater than end year (further in the past)' }
      }
    }
  } else {
    return { valid: false, error: 'Invalid date_type. Must be "date" or "astronomical"' }
  }

  return { valid: true }
}

// GET all events
router.get('/', async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json(mockEvents)
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// GET single event by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isSupabaseConfigured()) {
      const event = mockEvents.find(e => e.id === parseInt(id))
      if (!event) {
        return res.status(404).json({ error: 'Event not found' })
      }
      return res.json(event)
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found' })
      }
      throw error
    }
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// POST create new event
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      title, 
      description, 
      image_url,
      event_url,
      date_type = 'date',
      start_date, 
      end_date,
      astronomical_start_year,
      astronomical_end_year,
      label = null
    } = req.body

    const validation = validateEventData(req.body)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    const newEvent = {
      title: title.trim(),
      description: description?.trim() || null,
      image_url: image_url?.trim() || null,
      event_url: event_url?.trim() || null,
      date_type,
      start_date: date_type === 'date' ? start_date : null,
      end_date: date_type === 'date' ? (end_date || null) : null,
      astronomical_start_year: date_type === 'astronomical' ? Number(astronomical_start_year) : null,
      astronomical_end_year: date_type === 'astronomical' && astronomical_end_year ? Number(astronomical_end_year) : null,
      label: label?.trim() || null
    }

    if (!isSupabaseConfigured()) {
      const mockEvent = {
        ...newEvent,
        id: mockIdCounter++,
        created_at: new Date().toISOString()
      }
      mockEvents.push(mockEvent)
      return res.status(201).json(mockEvent)
    }

    const { data, error } = await supabase
      .from('events')
      .insert([newEvent])
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

// PUT update event
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { 
      title, 
      description, 
      image_url,
      event_url,
      date_type = 'date',
      start_date, 
      end_date,
      astronomical_start_year,
      astronomical_end_year,
      label = null
    } = req.body

    const validation = validateEventData(req.body, true)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    const updatedEvent = {
      title: title.trim(),
      description: description?.trim() || null,
      image_url: image_url?.trim() || null,
      event_url: event_url?.trim() || null,
      date_type,
      start_date: date_type === 'date' ? start_date : null,
      end_date: date_type === 'date' ? (end_date || null) : null,
      astronomical_start_year: date_type === 'astronomical' ? Number(astronomical_start_year) : null,
      astronomical_end_year: date_type === 'astronomical' && astronomical_end_year ? Number(astronomical_end_year) : null,
      label: label?.trim() || null
    }

    if (!isSupabaseConfigured()) {
      const index = mockEvents.findIndex(e => e.id === parseInt(id))
      if (index === -1) {
        return res.status(404).json({ error: 'Event not found' })
      }
      mockEvents[index] = { ...mockEvents[index], ...updatedEvent }
      return res.json(mockEvents[index])
    }

    const { data, error } = await supabase
      .from('events')
      .update(updatedEvent)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found' })
      }
      throw error
    }
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// DELETE event
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isSupabaseConfigured()) {
      const index = mockEvents.findIndex(e => e.id === parseInt(id))
      if (index === -1) {
        return res.status(404).json({ error: 'Event not found' })
      }
      mockEvents.splice(index, 1)
      return res.status(204).send()
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) throw error
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
