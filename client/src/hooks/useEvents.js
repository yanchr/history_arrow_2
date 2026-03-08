import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { withTimeout } from '../utils/asyncTimeout'

const REQUEST_TIMEOUT_MS = 15000

function toReadableError(error, fallbackMessage) {
  if (!error) return fallbackMessage
  if (error.code === '42501') return 'Not authorized. Please sign in with an admin account.'
  return error.message || fallbackMessage
}

export function useEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: true }),
        REQUEST_TIMEOUT_MS,
        'Request timed out while fetching events. Check local network or Supabase status.'
      )
      if (fetchError) throw fetchError
      setEvents(data)
    } catch (err) {
      setError(toReadableError(err, 'Failed to fetch events'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createEvent = async (eventData) => {
    const { data: newEvent, error: createError } = await withTimeout(
      supabase
        .from('events')
        .insert([eventData])
        .select()
        .single(),
      REQUEST_TIMEOUT_MS,
      'Request timed out while creating event. Check local network or Supabase status.'
    )
    if (createError) {
      throw new Error(toReadableError(createError, 'Failed to create event'))
    }
    setEvents(prev => [...prev, newEvent])
    return newEvent
  }

  const updateEvent = async (id, eventData) => {
    const { data: updatedEvent, error: updateError } = await withTimeout(
      supabase
        .from('events')
        .update(eventData)
        .eq('id', id)
        .select()
        .single(),
      REQUEST_TIMEOUT_MS,
      'Request timed out while updating event. Check local network or Supabase status.'
    )
    if (updateError) {
      throw new Error(toReadableError(updateError, 'Failed to update event'))
    }
    setEvents(prev => prev.map(e => e.id === id ? updatedEvent : e))
    return updatedEvent
  }

  const deleteEvent = async (id) => {
    const { error: deleteError } = await withTimeout(
      supabase
        .from('events')
        .delete()
        .eq('id', id),
      REQUEST_TIMEOUT_MS,
      'Request timed out while deleting event. Check local network or Supabase status.'
    )
    if (deleteError) {
      throw new Error(toReadableError(deleteError, 'Failed to delete event'))
    }
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent
  }
}
