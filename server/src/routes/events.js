import express from 'express'
import { supabase, isSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

// Mock data for when Supabase is not configured
let mockEvents = [
  {
    id: 1,
    title: 'Hadean Eon',
    description: 'The earliest eon in Earth\'s history, characterized by the formation of the planet.',
    start_date: '-4600000000-01-01',
    end_date: '-4000000000-01-01',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Invention of the Lightbulb',
    description: 'Thomas Edison demonstrated his incandescent light bulb.',
    start_date: '1879-10-21',
    end_date: null,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    title: 'World War II',
    description: 'A global conflict lasting from 1939 to 1945.',
    start_date: '1939-09-01',
    end_date: '1945-09-02',
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    title: 'Moon Landing',
    description: 'Apollo 11 astronauts became the first humans to walk on the Moon.',
    start_date: '1969-07-20',
    end_date: null,
    created_at: new Date().toISOString()
  }
]
let mockIdCounter = 5

// GET all events
router.get('/', async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json(mockEvents)
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true })

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
router.post('/', async (req, res, next) => {
  try {
    const { title, description, start_date, end_date } = req.body

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' })
    }
    if (!start_date) {
      return res.status(400).json({ error: 'Start date is required' })
    }

    // Validate date range if end_date is provided
    if (end_date) {
      const start = new Date(start_date)
      const end = new Date(end_date)
      if (start >= end) {
        return res.status(400).json({ error: 'End date must be after start date' })
      }
    }

    const newEvent = {
      title: title.trim(),
      description: description?.trim() || null,
      start_date,
      end_date: end_date || null
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
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { title, description, start_date, end_date } = req.body

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' })
    }
    if (!start_date) {
      return res.status(400).json({ error: 'Start date is required' })
    }

    if (end_date) {
      const start = new Date(start_date)
      const end = new Date(end_date)
      if (start >= end) {
        return res.status(400).json({ error: 'End date must be after start date' })
      }
    }

    const updatedEvent = {
      title: title.trim(),
      description: description?.trim() || null,
      start_date,
      end_date: end_date || null
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
router.delete('/:id', async (req, res, next) => {
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
