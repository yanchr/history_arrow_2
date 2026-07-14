import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../utils/supabase'
import { withTimeout } from '../utils/asyncTimeout'
import { useAuth } from './useAuth'
import {
  loadLocalEvents,
  createLocalEvent,
  updateLocalEvent,
  deleteLocalEvent,
  clearLocalEvents,
  isLocalEventId,
  toRemoteEventPayload
} from '../utils/localEvents'

const REQUEST_TIMEOUT_MS = 15000

function toReadableError(error, fallbackMessage) {
  if (!error) return fallbackMessage
  if (error.code === '42501') return 'Not authorized. Please sign in with an admin account.'
  return error.message || fallbackMessage
}

export function useEvents() {
  const { isAdmin, loading: authLoading } = useAuth()
  const canWriteRemote = isAdmin

  const [remoteEvents, setRemoteEvents] = useState([])
  const [localEvents, setLocalEvents] = useState(() => loadLocalEvents())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refreshLocalEvents = useCallback(() => {
    setLocalEvents(loadLocalEvents())
  }, [])

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
      setRemoteEvents(data)
    } catch (err) {
      setError(toReadableError(err, 'Failed to fetch events'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const events = useMemo(
    () => [...remoteEvents, ...localEvents],
    [remoteEvents, localEvents]
  )

  const assertAuthReady = () => {
    if (authLoading) {
      throw new Error('Still checking your account. Please try again in a moment.')
    }
  }

  const createEvent = async (eventData) => {
    assertAuthReady()
    if (!canWriteRemote) {
      const newEvent = createLocalEvent(eventData)
      refreshLocalEvents()
      return newEvent
    }

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
    setRemoteEvents(prev => [...prev, newEvent])
    return newEvent
  }

  const updateEvent = async (id, eventData) => {
    assertAuthReady()
    if (isLocalEventId(id) || !canWriteRemote) {
      if (!isLocalEventId(id)) {
        throw new Error('Not authorized. Please sign in with an admin account.')
      }
      const updated = updateLocalEvent(id, eventData)
      refreshLocalEvents()
      return updated
    }

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
    setRemoteEvents(prev => prev.map(e => e.id === id ? updatedEvent : e))
    return updatedEvent
  }

  const deleteEvent = async (id) => {
    assertAuthReady()
    if (isLocalEventId(id) || !canWriteRemote) {
      if (!isLocalEventId(id)) {
        throw new Error('Not authorized. Please sign in with an admin account.')
      }
      deleteLocalEvent(id)
      refreshLocalEvents()
      return
    }

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
    setRemoteEvents(prev => prev.filter(e => e.id !== id))
  }

  const syncLocalEventsToRemote = async () => {
    assertAuthReady()
    if (!canWriteRemote) {
      throw new Error('Not authorized. Please sign in with an admin account.')
    }

    const locals = loadLocalEvents()
    if (locals.length === 0) return []

    const idMap = new Map()
    const parents = locals.filter((e) => !e.parent_id)
    const children = locals.filter((e) => e.parent_id)

    const insertOne = async (payload) => {
      const { data, error: createError } = await withTimeout(
        supabase
          .from('events')
          .insert([payload])
          .select()
          .single(),
        REQUEST_TIMEOUT_MS,
        'Request timed out while syncing events. Check local network or Supabase status.'
      )
      if (createError) {
        throw new Error(toReadableError(createError, 'Failed to sync local events'))
      }
      return data
    }

    const created = []

    for (const parent of parents) {
      const remote = await insertOne(toRemoteEventPayload(parent, null))
      idMap.set(parent.id, remote.id)
      created.push(remote)
    }

    // Insert children; parents of children may themselves be local children in rare nests
    let remaining = [...children]
    let guard = remaining.length + 1
    while (remaining.length > 0 && guard > 0) {
      guard -= 1
      const nextRemaining = []
      for (const child of remaining) {
        const mappedParent = idMap.get(child.parent_id)
        if (child.parent_id && !mappedParent && isLocalEventId(child.parent_id)) {
          nextRemaining.push(child)
          continue
        }
        const remote = await insertOne(
          toRemoteEventPayload(child, mappedParent ?? child.parent_id ?? null)
        )
        idMap.set(child.id, remote.id)
        created.push(remote)
      }
      if (nextRemaining.length === remaining.length) {
        // Orphaned local children — insert with null parent rather than hang
        for (const child of nextRemaining) {
          const remote = await insertOne(toRemoteEventPayload(child, null))
          idMap.set(child.id, remote.id)
          created.push(remote)
        }
        break
      }
      remaining = nextRemaining
    }

    clearLocalEvents()
    refreshLocalEvents()
    setRemoteEvents(prev => [...prev, ...created])
    return created
  }

  return {
    events,
    localEvents,
    loading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    syncLocalEventsToRemote
  }
}
