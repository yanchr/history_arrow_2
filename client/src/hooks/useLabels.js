import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../utils/supabase'

function toReadableError(error, fallbackMessage) {
  if (!error) return fallbackMessage
  if (error.code === '42501') return 'Not authorized. Please sign in with an admin account.'
  if (error.code === '23505') return 'Label already exists'
  return error.message || fallbackMessage
}

export function useLabels() {
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('labels')
        .select('*')
        .order('name', { ascending: true })
      if (fetchError) throw fetchError
      setLabels(data)
    } catch (err) {
      setError(toReadableError(err, 'Failed to fetch labels'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const createLabel = async (name, color) => {
    const payload = {
      name: name.trim().toLowerCase(),
      color: (color || '#6b7280').trim()
    }
    const { data: newLabel, error: createError } = await supabase
      .from('labels')
      .insert([payload])
      .select()
      .single()
    if (createError) {
      throw new Error(toReadableError(createError, 'Failed to create label'))
    }
    setLabels(prev => [...prev, newLabel])
    return newLabel
  }

  const updateLabel = async (id, { name, color }) => {
    const { data: existing, error: findError } = await supabase
      .from('labels')
      .select('*')
      .eq('id', id)
      .single()
    if (findError) {
      throw new Error(toReadableError(findError, 'Failed to update label'))
    }

    const updates = {}
    if (name !== undefined) updates.name = name.trim().toLowerCase()
    if (color !== undefined) updates.color = color.trim()

    if (updates.name && updates.name !== existing.name) {
      const { error: relabelEventsError } = await supabase
        .from('events')
        .update({ label: updates.name })
        .eq('label', existing.name)
      if (relabelEventsError) {
        throw new Error(toReadableError(relabelEventsError, 'Failed to update label usage on events'))
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('labels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      throw new Error(toReadableError(updateError, 'Failed to update label'))
    }
    setLabels(prev => prev.map(l => l.id === id ? updated : l))
    return updated
  }

  const deleteLabel = async (id) => {
    const { data: label, error: findError } = await supabase
      .from('labels')
      .select('name')
      .eq('id', id)
      .single()
    if (findError) {
      throw new Error(toReadableError(findError, 'Failed to delete label'))
    }

    const { error: clearEventLabelsError } = await supabase
      .from('events')
      .update({ label: null })
      .eq('label', label.name)
    if (clearEventLabelsError) {
      throw new Error(toReadableError(clearEventLabelsError, 'Failed to detach label from events'))
    }

    const { error: deleteError } = await supabase
      .from('labels')
      .delete()
      .eq('id', id)
    if (deleteError) {
      throw new Error(toReadableError(deleteError, 'Failed to delete label'))
    }
    setLabels(prev => prev.filter(l => l.id !== id))
  }

  const labelColorMap = useMemo(() => {
    const map = new Map()
    labels.forEach(l => map.set(l.name, l.color))
    return map
  }, [labels])

  return {
    labels,
    loading,
    error,
    refetch: fetchLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    labelColorMap
  }
}
