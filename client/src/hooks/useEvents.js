import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '../utils/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export function useEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_URL}/api/events`)
      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }
      const data = await response.json()
      setEvents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createEvent = async (eventData) => {
    const auth = await getAuthHeaders()
    const response = await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth
      },
      body: JSON.stringify(eventData)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create event')
    }
    const newEvent = await response.json()
    setEvents(prev => [...prev, newEvent])
    return newEvent
  }

  const updateEvent = async (id, eventData) => {
    const auth = await getAuthHeaders()
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...auth
      },
      body: JSON.stringify(eventData)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update event')
    }
    const updatedEvent = await response.json()
    setEvents(prev => prev.map(e => e.id === id ? updatedEvent : e))
    return updatedEvent
  }

  const deleteEvent = async (id) => {
    const auth = await getAuthHeaders()
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: 'DELETE',
      headers: auth
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete event')
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
