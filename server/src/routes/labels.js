import express from 'express'
import { supabase, isSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

let mockLabels = [
  { id: '1', name: 'nature', color: '#22c55e', created_at: new Date().toISOString() },
  { id: '2', name: 'human', color: '#f59e0b', created_at: new Date().toISOString() },
  { id: '3', name: 'discovery', color: '#3b82f6', created_at: new Date().toISOString() },
  { id: '4', name: 'war', color: '#ef4444', created_at: new Date().toISOString() },
  { id: '5', name: 'technology', color: '#8b5cf6', created_at: new Date().toISOString() },
  { id: '6', name: 'culture', color: '#ec4899', created_at: new Date().toISOString() },
  { id: '7', name: 'politics', color: '#f97316', created_at: new Date().toISOString() },
]
let mockLabelIdCounter = 8

// GET all labels
router.get('/', async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json(mockLabels)
    }

    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// POST create new label
router.post('/', async (req, res, next) => {
  try {
    const { name, color = '#6b7280' } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Label name is required' })
    }

    if (!isSupabaseConfigured()) {
      if (mockLabels.some(l => l.name === name.trim().toLowerCase())) {
        return res.status(409).json({ error: 'Label already exists' })
      }
      const newLabel = {
        id: String(mockLabelIdCounter++),
        name: name.trim().toLowerCase(),
        color: color.trim(),
        created_at: new Date().toISOString()
      }
      mockLabels.push(newLabel)
      return res.status(201).json(newLabel)
    }

    const { data, error } = await supabase
      .from('labels')
      .insert([{ name: name.trim().toLowerCase(), color: color.trim() }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Label already exists' })
      }
      throw error
    }
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

// DELETE label and nullify events that use it
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isSupabaseConfigured()) {
      const index = mockLabels.findIndex(l => l.id === id)
      if (index === -1) {
        return res.status(404).json({ error: 'Label not found' })
      }
      const labelName = mockLabels[index].name
      mockLabels.splice(index, 1)
      // Importing mockEvents from events.js isn't feasible in mock mode;
      // the real DB path handles cascade below
      return res.status(204).send()
    }

    // Look up the label name before deleting
    const { data: label, error: findError } = await supabase
      .from('labels')
      .select('name')
      .eq('id', id)
      .single()

    if (findError) {
      if (findError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Label not found' })
      }
      throw findError
    }

    // Nullify the label on all events that reference it
    const { error: updateError } = await supabase
      .from('events')
      .update({ label: null })
      .eq('label', label.name)

    if (updateError) throw updateError

    // Delete the label
    const { error: deleteError } = await supabase
      .from('labels')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
