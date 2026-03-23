import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HistoryArrow from '../components/HistoryArrow'
import SelectedEventDetail from '../components/SelectedEventDetail'
import { useEvents } from '../hooks/useEvents'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useLabels'
import { useSeo } from '../hooks/useSeo'
import { sampleEvents } from '../data/sampleEvents'
import { formatEventDate } from '../utils/dateUtils'
import { eventToYearsAgo, eventEndToYearsAgo, formatYearsAgoShort } from '../utils/logScaleUtils'
import { canViewEventContent, getRestrictedContentMessage } from '../utils/contentVisibility'
import { getEventsForTimeline } from '../utils/eventHierarchy'
import './Home.css'
import './Game.css'

const isEventSpan = (event) => {
  if (event.date_type === 'astronomical') {
    return !!event.astronomical_end_year
  }
  return !!event.end_date
}

const PLAYER_COLORS = [
  '#f97316',
  '#06b6d4',
  '#eab308',
  '#a855f7',
  '#22c55e',
  '#ef4444',
  '#3b82f6',
  '#ec4899'
]

const ROUND_PHASE = {
  IDLE: 'idle',
  GUESSING: 'guessing',
  FINAL_REVEAL: 'final-reveal'
}
const EXCLUDED_GAME_LABEL = 'Eons'
const LONG_SPAN_YEARS_THRESHOLD = 2000

function Game() {
  useSeo({
    title: 'Timeline Guessing Game',
    description: 'Play a historical timeline game: guess where hidden events belong, score points, and challenge friends in multiplayer mode.',
    path: '/game'
  })

  const { events, loading, error } = useEvents()
  const { isAdmin } = useAuth()
  const { labels, labelColorMap } = useLabels()
  const timelineRef = useRef(null)

  const [displayEvents, setDisplayEvents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeLabels, setActiveLabels] = useState([])
  const [filterMode, setFilterMode] = useState('include')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const [players, setPlayers] = useState([])
  const [playerNameInputs, setPlayerNameInputs] = useState({})
  const [newPlayerInput, setNewPlayerInput] = useState('')

  const [roundEvent, setRoundEvent] = useState(null)
  const [guessYearsAgo, setGuessYearsAgo] = useState(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [yearsApart, setYearsApart] = useState(null)
  const [roundPoints, setRoundPoints] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [roundGuesses, setRoundGuesses] = useState([])
  const [roundPhase, setRoundPhase] = useState(ROUND_PHASE.IDLE)
  const [roundStartPlayerIndex, setRoundStartPlayerIndex] = useState(0)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [pointsPopup, setPointsPopup] = useState(null)
  const [gameError, setGameError] = useState('')

  const isMultiplayer = players.length > 0
  const isGuessingPhase = roundPhase === ROUND_PHASE.GUESSING
  const isFinalReveal = roundPhase === ROUND_PHASE.FINAL_REVEAL
  const isRevealFocus = !!roundEvent && isFinalReveal

  useEffect(() => {
    if (events && events.length > 0) {
      setDisplayEvents(events)
    } else if (!loading) {
      setDisplayEvents(sampleEvents)
    }
  }, [events, loading])

  const filteredEvents = useMemo(() => {
    const gameBaseEvents = displayEvents.filter(
      (event) => event.label !== EXCLUDED_GAME_LABEL && !event.parent_id
    )

    if (activeLabels.length === 0) return gameBaseEvents
    if (filterMode === 'include') {
      return gameBaseEvents.filter((event) => {
        if (!event.label && activeLabels.includes('__none__')) return true
        return event.label && activeLabels.includes(event.label)
      })
    }
    return gameBaseEvents.filter((event) => {
      if (!event.label && activeLabels.includes('__none__')) return false
      if (event.label && activeLabels.includes(event.label)) return false
      return true
    })
  }, [displayEvents, activeLabels, filterMode])

  const gameLabels = useMemo(() => {
    return labels.filter((labelItem) => labelItem.name !== EXCLUDED_GAME_LABEL)
  }, [labels])

  useEffect(() => {
    if (!players.length) {
      setCurrentPlayerIndex(0)
      setRoundStartPlayerIndex(0)
      return
    }

    setCurrentPlayerIndex((prev) => prev % players.length)
    setRoundStartPlayerIndex((prev) => prev % players.length)
  }, [players.length])

  const timelineEventsTopLevel = useMemo(() => {
    if (isFinalReveal) return []
    if (roundEvent && !isRevealed) {
      return filteredEvents.filter((event) => event.id !== roundEvent.id)
    }
    return filteredEvents
  }, [filteredEvents, isFinalReveal, roundEvent, isRevealed])

  const timelineEvents = useMemo(
    () => getEventsForTimeline(displayEvents, timelineEventsTopLevel),
    [displayEvents, timelineEventsTopLevel]
  )

  const searchFilteredEvents = useMemo(() => {
    const base = timelineEventsTopLevel
    if (!searchQuery.trim()) return base
    const query = searchQuery.toLowerCase()
    return base.filter((event) => {
      return event.title.toLowerCase().includes(query) || (
        canViewEventContent(event, isAdmin) &&
        event.description &&
        event.description.toLowerCase().includes(query)
      )
    })
  }, [timelineEventsTopLevel, searchQuery, isAdmin])

  const toggleLabel = useCallback((label) => {
    setActiveLabels((prev) => (prev.includes(label) ? prev.filter((value) => value !== label) : [...prev, label]))
  }, [])

  const activePlayer = useMemo(() => {
    if (!isMultiplayer || !roundEvent || isRevealed || !isGuessingPhase || players.length === 0) return null
    return players[currentPlayerIndex] || null
  }, [isMultiplayer, roundEvent, isRevealed, isGuessingPhase, players, currentPlayerIndex])

  const totalPlayerPoints = useMemo(() => {
    return players.reduce((sum, player) => sum + player.score, 0)
  }, [players])

  const gameGuessMarkers = useMemo(() => {
    if (!roundEvent || !isFinalReveal) return []

    return roundGuesses.map((guess, index) => ({
      id: `${guess.playerId}-${index}`,
      event: roundEvent,
      displayTitle: isMultiplayer ? guess.playerName : 'You',
      yearsAgo: guess.yearsAgo,
      color: guess.color,
      overlayClass: 'game-overlay-guess',
      laneDirection: index % 2 === 0 ? 1 : -1
    }))
  }, [roundGuesses, roundEvent, isFinalReveal, isMultiplayer])

  const gameActualMarker = useMemo(() => {
    if (!roundEvent || !isFinalReveal) return null
    return {
      id: `actual-${roundEvent.id}`,
      event: roundEvent,
      displayTitle: roundEvent.title,
      overlayClass: 'game-overlay-actual'
    }
  }, [roundEvent, isFinalReveal])

  const roundPointsByPlayer = useMemo(() => {
    const pointsMap = new Map()
    roundGuesses.forEach((guess) => {
      pointsMap.set(
        guess.playerId,
        (pointsMap.get(guess.playerId) || 0) + (guess.points || 0)
      )
    })
    return pointsMap
  }, [roundGuesses])

  const getPointsFromRelativeTimeError = useCallback((yearsOff, eventCenterYearsAgo) => {
    if (!Number.isFinite(yearsOff) || !Number.isFinite(eventCenterYearsAgo)) return 0

    const safeCenterYears = Math.max(1, eventCenterYearsAgo)
    const relativeError = yearsOff / safeCenterYears

    // Softer curve: near guesses retain more points, and perfect-ish guesses hit max quickly.
    const fullScoreThreshold = 0.015
    if (relativeError <= fullScoreThreshold) {
      return 5000
    }

    const softenedRatio = Math.max(0, 1 - Math.min(1, relativeError * 2))
    return Math.round(Math.pow(softenedRatio, 0.7) * 5000)
  }, [])

  const addPlayer = useCallback((rawName) => {
    const name = rawName.trim()
    if (!name) return

    const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length]
    const nextPlayer = { id: playerId, name, color, score: 0 }

    setPlayers((prev) => [...prev, nextPlayer])
    setPlayerNameInputs((prev) => ({ ...prev, [playerId]: name }))
    setNewPlayerInput('')
  }, [players.length])

  const commitPlayerRename = useCallback((playerId) => {
    const draftName = (playerNameInputs[playerId] || '').trim()
    if (!draftName) return

    setPlayers((prev) => prev.map((player) => (
      player.id === playerId ? { ...player, name: draftName } : player
    )))
  }, [playerNameInputs])

  const startRound = useCallback(() => {
    if (!filteredEvents.length) {
      setGameError('No events match the current filter.')
      return
    }

    const randomEvent = filteredEvents[Math.floor(Math.random() * filteredEvents.length)]
    if (!randomEvent) {
      setGameError('Could not pick an event. Try again.')
      return
    }

    setRoundEvent(randomEvent)
    setGuessYearsAgo(null)
    setIsRevealed(false)
    setYearsApart(null)
    setRoundPoints(0)
    setRoundGuesses([])
    setRoundPhase(ROUND_PHASE.GUESSING)
    setSelectedEvent(null)
    if (players.length > 0) {
      setCurrentPlayerIndex(roundStartPlayerIndex % players.length)
    }

    const roundStartYearsAgo = eventToYearsAgo(randomEvent)
    const roundEndYearsAgo = eventEndToYearsAgo(randomEvent)
    const roundDurationYears = (roundEndYearsAgo !== null && roundEndYearsAgo !== undefined)
      ? Math.abs(roundStartYearsAgo - roundEndYearsAgo)
      : 0

    if (roundDurationYears > LONG_SPAN_YEARS_THRESHOLD) {
      timelineRef.current?.centerOnEvent?.(randomEvent)
    } else {
      timelineRef.current?.resetView?.()
    }

    setGameError('')
  }, [filteredEvents, players.length, roundStartPlayerIndex])

  const handleGuessMove = useCallback(({ yearsAgo }) => {
    if (!roundEvent || isRevealed || !isGuessingPhase) return
    setGuessYearsAgo(yearsAgo)
  }, [roundEvent, isRevealed, isGuessingPhase])

  const handleGuessPlace = useCallback(({ yearsAgo }) => {
    if (!roundEvent || isRevealed || !isGuessingPhase) return

    const eventStart = eventToYearsAgo(roundEvent)
    const eventEnd = eventEndToYearsAgo(roundEvent)
    const eventCenter = eventEnd !== null && eventEnd !== undefined
      ? (eventStart + eventEnd) / 2
      : eventStart

    const distance = Math.abs(yearsAgo - eventCenter)
    const earnedPoints = getPointsFromRelativeTimeError(distance, eventCenter)

    if (!isMultiplayer) {
      setRoundGuesses([{
        playerId: 'single-player',
        playerName: 'You',
        color: null,
        yearsAgo,
        points: earnedPoints
      }])
      setGuessYearsAgo(yearsAgo)
      setYearsApart(distance)
      setRoundPoints(earnedPoints)
      setTotalPoints((prev) => prev + earnedPoints)
      setPointsPopup({ points: earnedPoints, key: Date.now() })
      setIsRevealed(true)
      setRoundPhase(ROUND_PHASE.FINAL_REVEAL)
      setSelectedEvent(roundEvent)
      timelineRef.current?.centerOnRevealGuesses?.(roundEvent, [yearsAgo])
      return
    }

    const active = players[currentPlayerIndex]
    if (!active) return

    const nextGuess = {
      playerId: active.id,
      playerName: active.name,
      color: active.color,
      yearsAgo,
      points: earnedPoints
    }
    const updatedGuesses = [...roundGuesses, nextGuess]
    setRoundGuesses(updatedGuesses)

    const finalGuessPlaced = updatedGuesses.length >= players.length
    if (!finalGuessPlaced) {
      setCurrentPlayerIndex((prev) => (prev + 1) % players.length)
      setGuessYearsAgo(null)
      return
    }

    const roundScoreTotal = updatedGuesses.reduce((sum, guess) => sum + guess.points, 0)
    const bestDistance = updatedGuesses.reduce((best, guess) => {
      const current = Math.abs(guess.yearsAgo - eventCenter)
      return Math.min(best, current)
    }, Number.POSITIVE_INFINITY)

    setPlayers((prev) => prev.map((player) => {
      const pointsForPlayer = updatedGuesses
        .filter((guess) => guess.playerId === player.id)
        .reduce((sum, guess) => sum + guess.points, 0)
      return { ...player, score: player.score + pointsForPlayer }
    }))
    setRoundPoints(roundScoreTotal)
    setYearsApart(Number.isFinite(bestDistance) ? bestDistance : distance)
    setPointsPopup({ points: roundScoreTotal, key: Date.now() })
    setIsRevealed(true)
    setRoundPhase(ROUND_PHASE.FINAL_REVEAL)
    setSelectedEvent(roundEvent)
    timelineRef.current?.centerOnRevealGuesses?.(
      roundEvent,
      updatedGuesses.map((guess) => guess.yearsAgo)
    )
    setRoundStartPlayerIndex((prev) => (prev + 1) % players.length)
  }, [
    roundEvent,
    isRevealed,
    isGuessingPhase,
    getPointsFromRelativeTimeError,
    isMultiplayer,
    players,
    currentPlayerIndex,
    roundGuesses
  ])

  const handleTimelineBackgroundClick = useCallback(() => {
    if (roundPhase !== ROUND_PHASE.FINAL_REVEAL) return
    setRoundPhase(ROUND_PHASE.IDLE)
    setRoundEvent(null)
    setRoundGuesses([])
    setGuessYearsAgo(null)
    setIsRevealed(false)
    setSelectedEvent(null)
    setYearsApart(null)
    setRoundPoints(0)
  }, [roundPhase])

  useEffect(() => {
    if (!pointsPopup) return undefined
    const timer = setTimeout(() => setPointsPopup(null), 1350)
    return () => clearTimeout(timer)
  }, [pointsPopup])

  const handleEventCardClick = useCallback((event) => {
    setSelectedEvent((prev) => (prev?.id === event.id ? null : event))
    timelineRef.current?.centerOnEvent(event)
  }, [])

  const handleEventClick = useCallback((event) => {
    setSelectedEvent((prev) => (prev?.id === event.id ? null : event))
  }, [])

  return (
    <div className={`home-page game-page ${isRevealFocus ? 'game-round-focus' : ''}`}>
      <motion.section
        className="hero-section game-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1 className="hero-title">Guess Timeline Position</h1>
        <p className="hero-subtitle">
          Start a round to hide one visible event, place it by hovering the timeline, then click to reveal your guess.
        </p>
        <div className="game-controls">
          <button className="btn btn-primary" onClick={startRound}>
            {roundEvent && !isRevealed ? 'New Hidden Event' : 'Start Round'}
          </button>
          {roundEvent && (
            <span className={`game-status-pill ${isRevealed ? 'revealed' : 'active'}`}>
              {isMultiplayer
                ? (
                    isRevealed
                      ? `Revealed · Best guess ${formatYearsAgoShort(yearsApart || 0)} apart · Round ${roundPoints} pts · Click timeline to resume`
                      : `Turn: ${activePlayer?.name || 'Player'} (${Math.min(roundGuesses.length + 1, players.length)}/${players.length})`
                  )
                : (
                    isRevealed
                      ? `Revealed: ${formatYearsAgoShort(yearsApart || 0)} apart · ${roundPoints} pts · Click timeline to resume`
                      : 'Round active: place your guess on timeline'
                  )}
            </span>
          )}
          <span className="game-total-points">
            Total: {isMultiplayer ? totalPlayerPoints : totalPoints} pts
          </span>
        </div>
        <AnimatePresence>
          {pointsPopup && (
            <motion.div
              key={pointsPopup.key}
              className="points-popup"
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: -6, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 1.03 }}
              transition={{ duration: 0.36, ease: 'easeOut' }}
            >
              +{pointsPopup.points} pts
            </motion.div>
          )}
        </AnimatePresence>
        {gameError && <p className="game-error">{gameError}</p>}
      </motion.section>

      <section className="multiplayer-panel">
        <h3>Players</h3>
        {players.map((player) => (
          <div
            key={player.id}
            className={`player-row ${activePlayer?.id === player.id ? 'active' : ''}`}
          >
            <input
              value={playerNameInputs[player.id] ?? player.name}
              onChange={(event) => {
                const value = event.target.value
                setPlayerNameInputs((prev) => ({ ...prev, [player.id]: value }))
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitPlayerRename(player.id)
                }
              }}
            />
            <div className="player-meta">
              <span className="player-color" style={{ backgroundColor: player.color }} />
              <span>
                {player.score} pts
                {isRevealed && roundPointsByPlayer.get(player.id)
                  ? ` · +${roundPointsByPlayer.get(player.id)}`
                  : ''}
              </span>
            </div>
          </div>
        ))}
        <div className="player-row new-player">
          <input
            placeholder="Add player and press Enter"
            value={newPlayerInput}
            onChange={(event) => setNewPlayerInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addPlayer(newPlayerInput)
              }
            }}
          />
        </div>
        {isMultiplayer && <span className="multiplayer-mode-pill">Multiplayer active</span>}
      </section>

      <div className="label-filter-bar">
        <div className="filter-mode-toggle">
          <button
            className={`filter-mode-btn ${filterMode === 'include' ? 'active' : ''}`}
            onClick={() => setFilterMode('include')}
          >
            Include
          </button>
          <button
            className={`filter-mode-btn ${filterMode === 'exclude' ? 'active' : ''}`}
            onClick={() => setFilterMode('exclude')}
          >
            Exclude
          </button>
        </div>
        <button
          className={`label-filter-chip ${activeLabels.includes('__none__') ? 'active' : ''}`}
          style={activeLabels.includes('__none__') ? { borderColor: '#6b7280', background: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' } : {}}
          onClick={() => toggleLabel('__none__')}
        >
          None
        </button>
        {gameLabels.map((labelItem) => {
          const isActive = activeLabels.includes(labelItem.name)
          return (
            <button
              key={labelItem.name}
              className={`label-filter-chip ${isActive ? 'active' : ''}`}
              style={isActive ? { borderColor: labelItem.color, background: `${labelItem.color}20`, color: labelItem.color } : {}}
              onClick={() => toggleLabel(labelItem.name)}
            >
              {labelItem.name}
            </button>
          )
        })}
        {activeLabels.length > 0 && (
          <button
            className="label-filter-chip"
            onClick={() => setActiveLabels([])}
            style={{ fontStyle: 'italic', opacity: 0.7 }}
          >
            Clear
          </button>
        )}
      </div>

      <motion.section
        className="timeline-section"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
      >
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading timeline...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>Using sample data (API not connected)</p>
          </div>
        ) : (
          <HistoryArrow
            ref={timelineRef}
            title="Game Timeline"
            events={timelineEvents}
            selectedEvent={selectedEvent}
            onEventClick={handleEventClick}
            labelColorMap={labelColorMap}
            hiddenEventIds={[]}
            showRandomEventButton={false}
            gameGhostEvent={roundEvent && isGuessingPhase ? roundEvent : null}
            gameGhostColor={isMultiplayer ? activePlayer?.color || null : null}
            gameGuessMarkers={gameGuessMarkers}
            gameActualMarker={gameActualMarker}
            onGameGuessMove={handleGuessMove}
            onGameGuessPlace={handleGuessPlace}
            onTimelineClick={handleTimelineBackgroundClick}
          />
        )}
      </motion.section>

      <AnimatePresence>
        {selectedEvent && (
          <motion.section
            className="selected-event-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SelectedEventDetail
              event={selectedEvent}
              allEvents={displayEvents}
              labelColor={selectedEvent?.label ? labelColorMap.get(selectedEvent.label) : null}
              onClose={() => setSelectedEvent(null)}
              isAdmin={isAdmin}
            />
          </motion.section>
        )}
      </AnimatePresence>

      <motion.section
        className="events-list-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.35 }}
      >
        <h2>Visible Event Cards ({searchFilteredEvents.length})</h2>
        <div className="search-bar-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search visible events..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="events-grid">
          {searchFilteredEvents.map((event, index) => {
            const eventIsSpan = isEventSpan(event)
            const startDateDisplay = formatEventDate(event, false)
            const endDateDisplay = formatEventDate(event, true)

            return (
              <motion.div
                key={event.id}
                className={`event-card ${selectedEvent?.id === event.id ? 'event-card--selected' : ''}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.24 }}
                onClick={() => handleEventCardClick(event)}
              >
                <div className="event-card-header">
                  <div className="event-badges">
                    <span className={`event-type-badge ${event.date_type === 'astronomical' ? 'astronomical' : 'historical'}`}>
                      {event.date_type === 'astronomical' ? 'Astronomical' : 'Historical'}
                    </span>
                    <span className={`event-type-badge ${eventIsSpan ? 'span' : 'point'}`}>
                      {eventIsSpan ? 'Span' : 'Point'}
                    </span>
                    {isAdmin && !event.is_published && (
                      <span className="event-type-badge unpublished">Unpublished</span>
                    )}
                    {event.label && (() => {
                      const color = labelColorMap.get(event.label)
                      return color ? (
                        <span className="event-label-badge" style={{ background: `${color}20`, color }}>
                          {event.label}
                        </span>
                      ) : (
                        <span className="event-label-badge">{event.label}</span>
                      )
                    })()}
                  </div>
                  <h3>{event.title}</h3>
                </div>
                {!canViewEventContent(event, isAdmin) && (
                  <p className="event-description event-description--restricted">
                    {getRestrictedContentMessage()}
                  </p>
                )}
                {canViewEventContent(event, isAdmin) && (
                  <p className="event-description">{event.description}</p>
                )}
                <div className="event-dates">
                  <span>{startDateDisplay}</span>
                  {eventIsSpan && endDateDisplay && (
                    <>
                      <span className="date-arrow">→</span>
                      <span>{endDateDisplay}</span>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.section>
    </div>
  )
}

export default Game
