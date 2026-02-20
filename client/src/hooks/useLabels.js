import { useState, useEffect, useCallback, useMemo } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export function useLabels() {
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_URL}/api/labels`)
      if (!response.ok) throw new Error('Failed to fetch labels')
      const data = await response.json()
      setLabels(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const createLabel = async (name, color) => {
    const response = await fetch(`${API_URL}/api/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to create label')
    }
    const newLabel = await response.json()
    setLabels(prev => [...prev, newLabel])
    return newLabel
  }

  const deleteLabel = async (id) => {
    const response = await fetch(`${API_URL}/api/labels/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to delete label')
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
    deleteLabel,
    labelColorMap
  }
}
