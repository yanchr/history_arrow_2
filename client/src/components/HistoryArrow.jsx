import { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion } from 'framer-motion'
import EventMarker from './EventMarker'
import LogarithmicMinimap from './LogarithmicMinimap'
import {
  yearToLinearPosition,
  linearPositionToYear,
  getLinearTicks,
  formatYearsAgoShort,
  dateToYearsAgo,
  eventToYearsAgo,
  eventEndToYearsAgo,
  DEFAULT_MIN_YEARS,
  DEFAULT_MAX_YEARS
} from '../utils/logScaleUtils'
import './HistoryArrow.css'

// Current date as a fractional year (e.g. 2026.14 for mid-February 2026)
const NOW = new Date()
const YEAR_START = new Date(NOW.getFullYear(), 0, 1)
const YEAR_END = new Date(NOW.getFullYear() + 1, 0, 1)
const CURRENT_YEAR = NOW.getFullYear() + (NOW - YEAR_START) / (YEAR_END - YEAR_START)
const IPHONE_MAX_WIDTH = 430
const IPHONE_MAX_SPAN_LANES = 4
const IPHONE_MAX_POINT_LANES = 5
const DESKTOP_MAX_SPAN_LANES = 15
const DESKTOP_MAX_POINT_LANES = 15
const IPHONE_VISIBLE_SPAN_LABEL_LANES = 2
const IPHONE_VISIBLE_POINT_LABEL_LANES = 2
const DESKTOP_VISIBLE_SPAN_LABEL_LANES = 5
const DESKTOP_VISIBLE_POINT_LABEL_LANES = 4
const SPAN_OVERLAP_PADDING_PERCENT = 0.35
const POINT_OVERLAP_PADDING_PERCENT = 0.25
const POINT_COLLISION_WIDTH_PERCENT = 1.6
const MIN_VISIBLE_SPAN_WIDTH_PERCENT = 1.2
const POINT_MARKER_WIDTH_PX = 16
const POINT_LABEL_MAX_WIDTH_PX = 120
const SPAN_LABEL_MAX_WIDTH_PX = 150
const LABEL_CHAR_WIDTH_PX = 6.4
const LABEL_PADDING_PX = 20
const DESKTOP_TIMELINE_BASE_HEIGHT = 170
const MOBILE_TIMELINE_BASE_HEIGHT = 136
const DESKTOP_SPAN_LANE_GAP = 20
const MOBILE_SPAN_LANE_GAP = 16
const DESKTOP_POINT_LANE_GAP = 20
const MOBILE_POINT_LANE_GAP = 14
const GEO_MAP_MIN_MA = 0
const GEO_MAP_MAX_MA = 530
const GEO_MAP_FRAME_COUNT = 531
const GEO_MAP_VIDEO_FPS = 30
const GEO_MAP_VIDEO_DURATION_SECONDS = (GEO_MAP_FRAME_COUNT - 1) / GEO_MAP_VIDEO_FPS
const GEO_MAP_VIDEO_FRAME_TIME = 1 / GEO_MAP_VIDEO_FPS
const LIFE_EXPECTANCY_WORLD_ENTITY = 'World'
const LIFE_EXPECTANCY_CONTINENTS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']
const MADDISON_REGION_ORDER = [
  'East Asia',
  'South and South East Asia',
  'Sub Saharan Africa',
  'Middle East and North Africa',
  'Latin America',
  'Eastern Europe',
  'Western Europe',
  'Western Offshoots'
]
const POPULATION_MAX_YEAR = 2022
const SPAN_SUB_FOCUS_HOVER_MS = 2000

function isTopLevelTimelineEvent(event) {
  return !event?.parent_id
}

const getValueAtOrBeforeYear = (valuesByYear, sortedYears, targetYear) => {
  if (!Number.isFinite(targetYear) || !valuesByYear || !Array.isArray(sortedYears) || sortedYears.length === 0) {
    return null
  }

  let left = 0
  let right = sortedYears.length - 1
  let bestYear = null

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const year = sortedYears[mid]

    if (year <= targetYear) {
      bestYear = year
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  if (bestYear === null) return null

  const value = valuesByYear instanceof Map
    ? valuesByYear.get(bestYear)
    : valuesByYear[String(bestYear)]

  if (!Number.isFinite(value)) return null
  return { year: bestYear, value }
}

const formatLifeExpectancy = (value) => `${value.toFixed(1)} years`

const formatPopulationCompact = (populationThousands) => {
  const population = populationThousands * 1000
  if (population >= 1e9) return `${(population / 1e9).toFixed(2).replace(/\.?0+$/, '')}B`
  if (population >= 1e6) return `${(population / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`
  return `${Math.round(population).toLocaleString()}`
}

const formatPopulationFull = (populationThousands) => {
  const population = Math.round(populationThousands * 1000)
  return population.toLocaleString()
}

const estimateLabelWidthPx = (title, maxWidthPx) => {
  const safeTitle = typeof title === 'string' ? title : ''
  const estimated = safeTitle.length * LABEL_CHAR_WIDTH_PX + LABEL_PADDING_PX
  return Math.min(maxWidthPx, Math.max(40, estimated))
}

const buildLaneLayout = (
  items,
  overlapPadding,
  isIphoneViewport,
  iphoneLaneCap,
  desktopLaneCap
) => {
  const sortedItems = [...items].sort((a, b) => {
    if (a.left !== b.left) return a.left - b.left
    if (a.width !== b.width) return b.width - a.width
    return String(a.id).localeCompare(String(b.id))
  })

  const laneRightEdges = []
  const assignments = []

  sortedItems.forEach(item => {
    let laneIndex = laneRightEdges.findIndex(
      rightEdge => item.left >= rightEdge + overlapPadding
    )

    if (laneIndex === -1) {
      laneIndex = laneRightEdges.length
      laneRightEdges.push(item.right)
    } else {
      laneRightEdges[laneIndex] = item.right
    }

    assignments.push({ id: item.id, laneIndex })
  })

  const rawLaneCount = laneRightEdges.length
  const effectiveLaneCount = rawLaneCount === 0
    ? 0
    : Math.min(rawLaneCount, isIphoneViewport ? iphoneLaneCap : desktopLaneCap)

  const laneMetadata = new Map()
  assignments.forEach(({ id, laneIndex }) => {
    const visualLane = effectiveLaneCount > 0 ? laneIndex % effectiveLaneCount : 0
    const laneRing = Math.floor(visualLane / 2) + 1
    const laneDirection = visualLane % 2 === 0 ? -1 : 1

    laneMetadata.set(id, {
      laneIndex,
      visualLane,
      laneRing,
      laneDirection,
      laneCount: rawLaneCount,
      effectiveLaneCount
    })
  })

  return {
    laneMetadata,
    rawLaneCount,
    effectiveLaneCount,
    lanesPerSide: effectiveLaneCount > 0 ? Math.ceil(effectiveLaneCount / 2) : 0
  }
}

const HistoryArrow = forwardRef(function HistoryArrow({
  events,
  selectedEvent,
  onEventClick,
  onVisibleEventsChange,
  labelColorMap = new Map(),
  title = 'Timeline of History',
  titleHint = '',
  hiddenEventIds = [],
  showRandomEventButton = true,
  gameGhostEvent = null,
  gameGhostColor = null,
  gameGuessMarkers = [],
  gameActualMarker = null,
  onGameGuessMove,
  onGameGuessPlace,
  onTimelineClick,
  gameReveal = null
}, ref) {
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [timelineHover, setTimelineHover] = useState({ active: false, x: 0, percentage: 0, yearsAgo: 0 })
  const [isIphoneViewport, setIsIphoneViewport] = useState(false)
  const [eventsLayerWidth, setEventsLayerWidth] = useState(1000)
  const [centerInputType, setCenterInputType] = useState('date')
  const [centerInputValue, setCenterInputValue] = useState('')
  const [centerInputError, setCenterInputError] = useState('')
  const [manualCenterLabel, setManualCenterLabel] = useState('')
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true)
  const [mapMiniHover, setMapMiniHover] = useState({ active: false, percentage: 0 })
  const [lastTimelineYearsAgo, setLastTimelineYearsAgo] = useState(null)
  const [lastMapMiniPercentage, setLastMapMiniPercentage] = useState(null)
  const [subFocusParentId, setSubFocusParentId] = useState(null)
  const [inlineVideoReady, setInlineVideoReady] = useState(false)
  const [modalVideoReady, setModalVideoReady] = useState(false)
  const [lifeExpectancyByEntity, setLifeExpectancyByEntity] = useState(() => new Map())
  const [lifeExpectancyYearsByEntity, setLifeExpectancyYearsByEntity] = useState(() => new Map())
  const [populationWorldByYear, setPopulationWorldByYear] = useState({})
  const [populationRegionsByYear, setPopulationRegionsByYear] = useState({})
  const [populationYears, setPopulationYears] = useState([])
  // View state: years ago for the visible range
  // viewStart = closer to present (smaller years ago)
  // viewEnd = further in past (larger years ago)
  const [viewStart, setViewStart] = useState(DEFAULT_MIN_YEARS)
  const [viewEnd, setViewEnd] = useState(CURRENT_YEAR) // Default to year 0 (2026 years ago)
  const timelineRef = useRef(null)
  const eventsLayerRef = useRef(null)
  const inlineMapVideoRef = useRef(null)
  const modalMapVideoRef = useRef(null)
  const hiddenEventIdSet = useMemo(() => new Set(hiddenEventIds), [hiddenEventIds])

  useEffect(() => {
    let cancelled = false

    const loadDemographicData = async () => {
      try {
        const [lifeResponse, populationResponse] = await Promise.all([
          fetch('/data/life-expectancy.csv'),
          fetch('/data/maddison2023_population_aggregates.json')
        ])

        if (!lifeResponse.ok || !populationResponse.ok) {
          throw new Error('Failed to load demographic data.')
        }

        const [lifeCsv, populationJson] = await Promise.all([
          lifeResponse.text(),
          populationResponse.json()
        ])

        if (cancelled) return

        const lifeByEntity = new Map()
        const lines = lifeCsv.split(/\r?\n/).filter(Boolean)
        lines.slice(1).forEach((line) => {
          const [entity, , yearString, valueString] = line.split(',')
          const year = Number(yearString)
          const value = Number(valueString)
          if (!entity || !Number.isFinite(year) || !Number.isFinite(value)) return

          const entityMap = lifeByEntity.get(entity) || new Map()
          entityMap.set(year, value)
          lifeByEntity.set(entity, entityMap)
        })

        const yearsByEntity = new Map()
        lifeByEntity.forEach((entityMap, entity) => {
          const sortedYears = [...entityMap.keys()].sort((a, b) => a - b)
          yearsByEntity.set(entity, sortedYears)
        })

        const worldByYear = populationJson?.worldByYear || {}
        const regionsByYear = populationJson?.regionsByYear || {}
        const sortedPopulationYears = Object.keys(worldByYear)
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b)

        setLifeExpectancyByEntity(lifeByEntity)
        setLifeExpectancyYearsByEntity(yearsByEntity)
        setPopulationWorldByYear(worldByYear)
        setPopulationRegionsByYear(regionsByYear)
        setPopulationYears(sortedPopulationYears)
      } catch (error) {
        console.error('Could not load demographic overlays:', error)
      }
    }

    loadDemographicData()
    return () => {
      cancelled = true
    }
  }, [])

  const centerViewOnEvent = useCallback((event) => {
    const startYearsAgo = eventToYearsAgo(event)
    const endYearsAgo = eventEndToYearsAgo(event)
    const yearsAgo = endYearsAgo != null
      ? (startYearsAgo + endYearsAgo) / 2
      : startYearsAgo
    const newEnd = Math.min(yearsAgo * 2, DEFAULT_MAX_YEARS)
    setViewStart(DEFAULT_MIN_YEARS)
    setViewEnd(newEnd)
    setManualCenterLabel('')
    setCenterInputError('')
  }, [])

  const centerViewOnRevealGuesses = useCallback((event, guessYearsAgoList = []) => {
    if (!event) return

    const startYearsAgo = eventToYearsAgo(event)
    const endYearsAgo = eventEndToYearsAgo(event)
    const centerYearsAgo = endYearsAgo != null
      ? (startYearsAgo + endYearsAgo) / 2
      : startYearsAgo
    const eventHalfDuration = endYearsAgo != null
      ? Math.abs(startYearsAgo - endYearsAgo) / 2
      : 0

    const validGuessOffsets = (Array.isArray(guessYearsAgoList) ? guessYearsAgoList : [])
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.abs(value - centerYearsAgo))

    const farthestGuessOffset = validGuessOffsets.length
      ? Math.max(...validGuessOffsets)
      : 0

    const halfSpan = Math.max(
      5,
      eventHalfDuration,
      farthestGuessOffset
    ) * 1.2

    const proposedStart = centerYearsAgo - halfSpan
    const proposedEnd = centerYearsAgo + halfSpan
    const boundedStart = Math.max(DEFAULT_MIN_YEARS, proposedStart)
    const boundedEnd = Math.min(DEFAULT_MAX_YEARS, proposedEnd)

    if (boundedEnd - boundedStart < 1) {
      setViewStart(Math.max(DEFAULT_MIN_YEARS, centerYearsAgo - 0.5))
      setViewEnd(Math.min(DEFAULT_MAX_YEARS, centerYearsAgo + 0.5))
    } else {
      setViewStart(boundedStart)
      setViewEnd(boundedEnd)
    }
    setManualCenterLabel('')
    setCenterInputError('')
  }, [])

  const centerViewOnYearsAgo = useCallback((yearsAgo) => {
    const safeYearsAgo = Math.max(DEFAULT_MIN_YEARS, Math.min(DEFAULT_MAX_YEARS, yearsAgo))
    // Keep "years ago" value in the middle by anchoring to present (0) and using 2x span.
    setViewStart(DEFAULT_MIN_YEARS)
    setViewEnd(Math.min(DEFAULT_MAX_YEARS, safeYearsAgo * 2))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(`(max-width: ${IPHONE_MAX_WIDTH}px)`)
    const syncViewport = (eventOrQuery) => {
      setIsIphoneViewport(eventOrQuery.matches)
    }

    syncViewport(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport)
      return () => mediaQuery.removeEventListener('change', syncViewport)
    }

    mediaQuery.addListener(syncViewport)
    return () => mediaQuery.removeListener(syncViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!eventsLayerRef.current || typeof ResizeObserver === 'undefined') return undefined

    const updateWidth = (width) => {
      if (width > 0) {
        setEventsLayerWidth(width)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry?.contentRect?.width) {
        updateWidth(entry.contentRect.width)
      }
    })

    observer.observe(eventsLayerRef.current)
    updateWidth(eventsLayerRef.current.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  // Calculate the overall bounds from events
  const eventBounds = useMemo(() => {
    if (!events || events.length === 0) {
      return { min: DEFAULT_MIN_YEARS, max: DEFAULT_MAX_YEARS }
    }

    let minYearsAgo = Infinity
    let maxYearsAgo = 0

    events.filter(isTopLevelTimelineEvent).forEach(event => {
      const startYearsAgo = eventToYearsAgo(event)
      const endYearsAgo = eventEndToYearsAgo(event)

      if (startYearsAgo < minYearsAgo) minYearsAgo = startYearsAgo
      if (startYearsAgo > maxYearsAgo) maxYearsAgo = startYearsAgo
      if (endYearsAgo !== null) {
        if (endYearsAgo < minYearsAgo) minYearsAgo = endYearsAgo
        if (endYearsAgo > maxYearsAgo) maxYearsAgo = endYearsAgo
      }
    })

    // Add padding in log space
    const logMin = Math.log10(Math.max(1, minYearsAgo))
    const logMax = Math.log10(maxYearsAgo)
    const logPadding = (logMax - logMin) * 0.05

    return {
      min: Math.max(1, Math.pow(10, logMin - logPadding)),
      max: Math.pow(10, logMax + logPadding)
    }
  }, [events])

  // Generate timeline tick marks for the current view (LINEAR for the arrow)
  const timelineTicks = useMemo(() => {
    return getLinearTicks(viewStart, viewEnd)
  }, [viewStart, viewEnd])

  // Position events on the timeline using LINEAR scale
  const positionedEvents = useMemo(() => {
    return events
      .filter(isTopLevelTimelineEvent)
      .map(event => {
        const startYearsAgo = eventToYearsAgo(event)
        const endYearsAgo = eventEndToYearsAgo(event)

        // Determine if the event is a span based on date_type and end values
        const isSpan = event.date_type === 'astronomical'
          ? !!event.astronomical_end_year
          : !!event.end_date

        return {
          ...event,
          isSpan,
          yearsAgo: startYearsAgo,
          endYearsAgo
        }
      })
      .filter(event => {
        if (hiddenEventIdSet.has(event.id)) {
          return false
        }

        // Filter out events completely outside the current view BEFORE positioning
        // viewStart = closest to present (smaller years ago)
        // viewEnd = furthest in past (larger years ago)
        const startYearsAgo = event.yearsAgo
        const endYearsAgo = event.endYearsAgo

        // For point events: must be within view range
        if (!event.isSpan) {
          return startYearsAgo >= viewStart && startYearsAgo <= viewEnd
        }

        // For span events: any part of the span must overlap with view range
        // Span goes from startYearsAgo (older/further in past) to endYearsAgo (newer/closer to present)
        const spanStart = Math.max(startYearsAgo, endYearsAgo || startYearsAgo)
        const spanEnd = Math.min(startYearsAgo, endYearsAgo || startYearsAgo)
        
        // Check if span overlaps with view
        return spanStart >= viewStart && spanEnd <= viewEnd
      })
      .map(event => {
        // Now calculate LINEAR positions for visible events
        const startPos = yearToLinearPosition(event.yearsAgo, viewStart, viewEnd)
        const endPos = event.endYearsAgo !== null
          ? yearToLinearPosition(event.endYearsAgo, viewStart, viewEnd)
          : null

        const spanWidth = endPos !== null ? Math.abs(endPos - startPos) : 0
        const shouldRenderAsPoint = event.isSpan && spanWidth < MIN_VISIBLE_SPAN_WIDTH_PERCENT
        const centeredYearsAgo = event.endYearsAgo !== null
          ? (event.yearsAgo + event.endYearsAgo) / 2
          : event.yearsAgo
        const centeredPos = endPos !== null
          ? (startPos + endPos) / 2
          : startPos

        return {
          ...event,
          yearsAgo: shouldRenderAsPoint ? centeredYearsAgo : event.yearsAgo,
          isSpan: shouldRenderAsPoint ? false : event.isSpan,
          startPos: shouldRenderAsPoint ? centeredPos : startPos,
          endPos: shouldRenderAsPoint ? null : endPos
        }
      })
  }, [events, viewStart, viewEnd, hiddenEventIdSet])

  const spanLaneLayout = useMemo(() => {
    const laneItems = positionedEvents
      .filter(event => event.isSpan && event.endPos !== null)
      .map(event => {
        const spanLeft = Math.min(event.startPos, event.endPos)
        const spanRight = Math.max(event.startPos, event.endPos)
        const spanCenter = (spanLeft + spanRight) / 2
        const labelWidthPx = estimateLabelWidthPx(event.title, SPAN_LABEL_MAX_WIDTH_PX)
        const labelWidthPercent = (labelWidthPx / eventsLayerWidth) * 100
        const labelLeft = spanCenter - labelWidthPercent / 2
        const labelRight = spanCenter + labelWidthPercent / 2
        const left = Math.min(spanLeft, labelLeft)
        const right = Math.max(spanRight, labelRight)

        return {
          id: event.id,
          left,
          right,
          width: right - left
        }
      })
    return buildLaneLayout(
      laneItems,
      SPAN_OVERLAP_PADDING_PERCENT,
      isIphoneViewport,
      IPHONE_MAX_SPAN_LANES,
      DESKTOP_MAX_SPAN_LANES
    )
  }, [positionedEvents, isIphoneViewport, eventsLayerWidth])

  const pointLaneLayout = useMemo(() => {
    const laneItems = positionedEvents
      .filter(event => !event.isSpan)
      .map(event => {
        const markerWidthPercent = Math.max(
          POINT_COLLISION_WIDTH_PERCENT,
          (POINT_MARKER_WIDTH_PX / eventsLayerWidth) * 100
        )
        const markerLeft = event.startPos - markerWidthPercent / 2
        const markerRight = event.startPos + markerWidthPercent / 2
        const labelWidthPx = estimateLabelWidthPx(event.title, POINT_LABEL_MAX_WIDTH_PX)
        const labelWidthPercent = (labelWidthPx / eventsLayerWidth) * 100
        const labelLeft = event.startPos - labelWidthPercent / 2
        const labelRight = event.startPos + labelWidthPercent / 2
        const left = Math.min(markerLeft, labelLeft)
        const right = Math.max(markerRight, labelRight)

        return {
          id: event.id,
          left,
          right,
          width: right - left
        }
      })

    return buildLaneLayout(
      laneItems,
      POINT_OVERLAP_PADDING_PERCENT,
      isIphoneViewport,
      IPHONE_MAX_POINT_LANES,
      DESKTOP_MAX_POINT_LANES
    )
  }, [positionedEvents, isIphoneViewport, eventsLayerWidth])

  const timelineLayoutStyle = useMemo(() => {
    const baseHeight = isIphoneViewport ? MOBILE_TIMELINE_BASE_HEIGHT : DESKTOP_TIMELINE_BASE_HEIGHT
    const spanLaneGap = isIphoneViewport ? MOBILE_SPAN_LANE_GAP : DESKTOP_SPAN_LANE_GAP
    const pointLaneGap = isIphoneViewport ? MOBILE_POINT_LANE_GAP : DESKTOP_POINT_LANE_GAP
    const maxSpanLanesPerSide = Math.ceil(
      (isIphoneViewport ? IPHONE_MAX_SPAN_LANES : DESKTOP_MAX_SPAN_LANES) / 2
    )
    const maxPointLanesPerSide = Math.ceil(
      (isIphoneViewport ? IPHONE_MAX_POINT_LANES : DESKTOP_MAX_POINT_LANES) / 2
    )
    // Keep wrapper height stable regardless of how many events are visible.
    const laneDepthPx = Math.max(
      maxSpanLanesPerSide * spanLaneGap,
      maxPointLanesPerSide * pointLaneGap
    )

    return {
      '--timeline-base-height': `${baseHeight}px`,
      '--span-lane-gap': `${spanLaneGap}px`,
      '--point-lane-gap': `${pointLaneGap}px`,
      '--span-lane-depth': spanLaneLayout.lanesPerSide,
      '--point-lane-depth': pointLaneLayout.lanesPerSide,
      '--span-lane-count': spanLaneLayout.effectiveLaneCount,
      '--point-lane-count': pointLaneLayout.effectiveLaneCount,
      '--timeline-lane-depth-px': `${laneDepthPx}px`
    }
  }, [
    isIphoneViewport,
    spanLaneLayout.effectiveLaneCount,
    pointLaneLayout.effectiveLaneCount
  ])

  const laneAwareEvents = useMemo(() => {
    return positionedEvents.map(event => {
      if (event.isSpan) {
        const spanLaneMeta = spanLaneLayout.laneMetadata.get(event.id)
        return {
          ...event,
          spanLaneIndex: spanLaneMeta?.laneIndex ?? 0,
          spanVisualLane: spanLaneMeta?.visualLane ?? 0,
          spanLaneRing: spanLaneMeta?.laneRing ?? 1,
          spanLaneDirection: spanLaneMeta?.laneDirection ?? -1,
          spanLaneCount: spanLaneMeta?.laneCount ?? 1,
          spanEffectiveLaneCount: spanLaneMeta?.effectiveLaneCount ?? 1
        }
      }

      const pointLaneMeta = pointLaneLayout.laneMetadata.get(event.id)
      return {
        ...event,
        pointLaneIndex: pointLaneMeta?.laneIndex ?? 0,
        pointVisualLane: pointLaneMeta?.visualLane ?? 0,
        pointLaneRing: pointLaneMeta?.laneRing ?? 1,
        pointLaneDirection: pointLaneMeta?.laneDirection ?? -1,
        pointLaneCount: pointLaneMeta?.laneCount ?? 1,
        pointEffectiveLaneCount: pointLaneMeta?.effectiveLaneCount ?? 1
      }
    })
  }, [positionedEvents, spanLaneLayout.laneMetadata, pointLaneLayout.laneMetadata])

  const focusParentLaneEvent = useMemo(() => {
    if (!subFocusParentId) return null
    return laneAwareEvents.find((e) => e.id === subFocusParentId && e.isSpan) ?? null
  }, [laneAwareEvents, subFocusParentId])

  const positionedSubEvents = useMemo(() => {
    if (!subFocusParentId) return []
    return events
      .filter((e) => e.parent_id === subFocusParentId)
      .map((event) => {
        const startYearsAgo = eventToYearsAgo(event)
        const endYearsAgo = eventEndToYearsAgo(event)
        return { ...event, isSpan: false, yearsAgo: startYearsAgo, endYearsAgo }
      })
      .filter((event) => {
        const startYearsAgo = event.yearsAgo
        return startYearsAgo >= viewStart && startYearsAgo <= viewEnd
      })
      .map((event, index) => {
        const startPos = yearToLinearPosition(event.yearsAgo, viewStart, viewEnd)
        const visualLane = index % 2
        const pointLaneDirection = visualLane === 0 ? -1 : 1
        return {
          ...event,
          isSpan: false,
          startPos,
          endPos: null,
          pointLaneIndex: 0,
          pointVisualLane: visualLane,
          pointLaneRing: 1,
          pointLaneDirection,
          pointLaneCount: 1,
          pointEffectiveLaneCount: 2
        }
      })
  }, [events, subFocusParentId, viewStart, viewEnd])

  useEffect(() => {
    if (!subFocusParentId) return
    if (!focusParentLaneEvent) setSubFocusParentId(null)
  }, [subFocusParentId, focusParentLaneEvent])

  const handleSpanSubFocusComplete = useCallback((spanEvent) => {
    setSubFocusParentId(spanEvent.id)
  }, [])

  const handleExitSubFocus = useCallback(() => {
    setSubFocusParentId(null)
  }, [])

  // Notify parent of visible events changes
  useEffect(() => {
    if (onVisibleEventsChange) {
      onVisibleEventsChange(positionedEvents)
    }
  }, [positionedEvents, onVisibleEventsChange])

  const handleEventHover = (event) => {
    setHoveredEvent(event)
  }

  // Handle view changes from the minimap
  const handleViewChange = useCallback((newStart, newEnd) => {
    setViewStart(Math.max(DEFAULT_MIN_YEARS, newStart))
    setViewEnd(Math.min(DEFAULT_MAX_YEARS, newEnd))
    setManualCenterLabel('')
    setCenterInputError('')
  }, [])

  // Reset view to show all events
  const handleReset = useCallback(() => {
    setViewStart(DEFAULT_MIN_YEARS)
    setViewEnd(CURRENT_YEAR)
    setManualCenterLabel('')
    setCenterInputError('')
  }, [])

  useImperativeHandle(ref, () => ({
    centerOnEvent: centerViewOnEvent,
    centerOnRevealGuesses: centerViewOnRevealGuesses,
    resetView: handleReset
  }), [centerViewOnEvent, centerViewOnRevealGuesses, handleReset])

  const handleRandomEventSelect = useCallback(() => {
    if (!events || events.length === 0) return

    const topLevel = events.filter(isTopLevelTimelineEvent)
    const candidates = topLevel.length > 1 && selectedEvent
      ? topLevel.filter(event => event.id !== selectedEvent.id)
      : topLevel

    const randomEvent = candidates[Math.floor(Math.random() * candidates.length)]
    if (!randomEvent) return

    onEventClick?.(randomEvent)
    centerViewOnEvent(randomEvent)
  }, [events, selectedEvent, onEventClick, centerViewOnEvent])

  const handleCenterInputSubmit = useCallback((e) => {
    e.preventDefault()
    setCenterInputError('')

    if (!centerInputValue.trim()) {
      setCenterInputError('Enter a value first.')
      return
    }

    if (centerInputType === 'date') {
      const parsedDate = new Date(centerInputValue)
      if (Number.isNaN(parsedDate.getTime())) {
        setCenterInputError('Please enter a valid date.')
        return
      }

      const yearsAgo = dateToYearsAgo(parsedDate)
      centerViewOnYearsAgo(yearsAgo)
      setManualCenterLabel(parsedDate.toLocaleDateString())
      return
    }

    const numericValue = Number(centerInputValue.replace(/,/g, '').trim())
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setCenterInputError('Astronomical year must be a positive number.')
      return
    }

    centerViewOnYearsAgo(numericValue)
    setManualCenterLabel(`${formatYearsAgoShort(numericValue)} ago`)
  }, [centerInputType, centerInputValue, centerViewOnYearsAgo])

  // Handle mouse move over timeline to show current position
  const handleTimelineMouseMove = useCallback((e) => {
    if (!eventsLayerRef.current) return
    
    const rect = eventsLayerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    
    // Convert position to years ago
    const yearsAgo = linearPositionToYear(percentage, viewStart, viewEnd)
    
    setTimelineHover({
      active: true,
      x: e.clientX - rect.left + 60, // Offset for the events layer margin
      percentage,
      yearsAgo
    })
    setLastTimelineYearsAgo(yearsAgo)
    onGameGuessMove?.({ percentage, yearsAgo })
  }, [viewStart, viewEnd, onGameGuessMove])

  // Keep hover readout in sync when view changes (including keyboard pan/zoom).
  useEffect(() => {
    if (!timelineHover.active) return

    const yearsAgo = linearPositionToYear(timelineHover.percentage, viewStart, viewEnd)
    setTimelineHover(prev => {
      if (Math.abs(prev.yearsAgo - yearsAgo) < 1e-6) return prev
      return { ...prev, yearsAgo }
    })
    setLastTimelineYearsAgo(yearsAgo)
    onGameGuessMove?.({ percentage: timelineHover.percentage, yearsAgo })
  }, [timelineHover.active, timelineHover.percentage, viewStart, viewEnd, onGameGuessMove])

  const handleTimelineMouseLeave = useCallback(() => {
    setTimelineHover(prev => ({ ...prev, active: false }))
  }, [])

  const handleTimelineClick = useCallback(() => {
    if (timelineHover.active) {
      const guessPercentage = yearToLinearPosition(timelineHover.yearsAgo, viewStart, viewEnd)

      onGameGuessPlace?.({
        percentage: guessPercentage,
        yearsAgo: timelineHover.yearsAgo
      })
    }
    onTimelineClick?.()
  }, [timelineHover, onGameGuessPlace, onTimelineClick, viewStart, viewEnd])

  const formatHoverTime = (yearsAgo) => {
    if (yearsAgo <= CURRENT_YEAR) {
      const fractionalYear = CURRENT_YEAR - yearsAgo
      const year = Math.floor(fractionalYear)

      if (year >= 2000) {
        const startOfYear = new Date(year, 0, 1)
        const endOfYear = new Date(year + 1, 0, 1)
        const msInYear = endOfYear - startOfYear
        const dayOffset = (fractionalYear - year) * msInYear
        const date = new Date(startOfYear.getTime() + dayOffset)
        const dd = String(date.getDate()).padStart(2, '0')
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        return `${dd}.${mm}.${date.getFullYear()}`
      }

      if (year < 0) {
        return `${Math.abs(year)} BCE`
      }
      return `${year} CE`
    }
    
    if (yearsAgo >= 1e9) {
      return `${(yearsAgo / 1e9).toFixed(2)} billion years ago`
    } else if (yearsAgo >= 1e6) {
      return `${(yearsAgo / 1e6).toFixed(2)} million years ago`
    } else if (yearsAgo >= 1e3) {
      return `${(yearsAgo / 1e3).toFixed(1)}k years ago`
    } else {
      return `${Math.round(yearsAgo)} years ago`
    }
  }

  const formatElapsedYears = (value) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} billion years`
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)} million years`
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k years`

    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
    const unit = rounded === 1 ? 'year' : 'years'
    return `${rounded} ${unit}`
  }

  const getHoveredEventElapsedLines = (event, hoverYearsAgo) => {
    if (!event || hoverYearsAgo === null || hoverYearsAgo === undefined) return []

    const hasEnd = event.endYearsAgo !== null && event.endYearsAgo !== undefined
    const totalDuration = hasEnd
      ? Math.max(0, event.yearsAgo - event.endYearsAgo)
      : null

    if (!hasEnd) {
      return [`${formatElapsedYears(Math.max(0, event.yearsAgo))} old`]
    }

    let fromStartToHover = Math.max(0, event.yearsAgo - hoverYearsAgo)
    if (totalDuration !== null) {
      fromStartToHover = Math.min(fromStartToHover, totalDuration)
    }

    const lines = [`${formatElapsedYears(fromStartToHover)} old`]
    if (totalDuration !== null) {
      lines.push(`${formatElapsedYears(totalDuration)} total`)
    }
    return lines
  }

  const buildGhostPlacement = useCallback((event, centerYearsAgo) => {
    if (!event || centerYearsAgo === null || centerYearsAgo === undefined) return null

    const startYearsAgo = eventToYearsAgo(event)
    const endYearsAgo = eventEndToYearsAgo(event)
    const isSpan = endYearsAgo !== null && endYearsAgo !== undefined
    const duration = isSpan ? Math.max(0, startYearsAgo - endYearsAgo) : 0
    const guessStartYears = isSpan ? centerYearsAgo + duration / 2 : centerYearsAgo
    const guessEndYears = isSpan ? centerYearsAgo - duration / 2 : null

    return {
      isSpan,
      centerYearsAgo,
      startPos: yearToLinearPosition(guessStartYears, viewStart, viewEnd),
      endPos: guessEndYears !== null
        ? yearToLinearPosition(guessEndYears, viewStart, viewEnd)
        : null
    }
  }, [viewStart, viewEnd])

  const ghostPlacement = useMemo(() => {
    if (!gameGhostEvent || !timelineHover.active) return null
    return buildGhostPlacement(gameGhostEvent, timelineHover.yearsAgo)
  }, [gameGhostEvent, timelineHover, buildGhostPlacement])

  const minimapEvents = useMemo(() => {
    const topLevel = events.filter(isTopLevelTimelineEvent)
    if (!hiddenEventIdSet.size) return topLevel
    return topLevel.filter(event => !hiddenEventIdSet.has(event.id))
  }, [events, hiddenEventIdSet])

  const mapYearsAgo = useMemo(() => {
    if (isMapModalOpen && mapMiniHover.active) {
      return linearPositionToYear(mapMiniHover.percentage, GEO_MAP_MIN_MA * 1e6, GEO_MAP_MAX_MA * 1e6)
    }
    if (isMapModalOpen && Number.isFinite(lastMapMiniPercentage)) {
      return linearPositionToYear(lastMapMiniPercentage, GEO_MAP_MIN_MA * 1e6, GEO_MAP_MAX_MA * 1e6)
    }
    if (timelineHover.active) {
      return timelineHover.yearsAgo
    }
    if (Number.isFinite(lastTimelineYearsAgo)) {
      return lastTimelineYearsAgo
    }
    return (viewStart + viewEnd) / 2
  }, [
    mapMiniHover.active,
    mapMiniHover.percentage,
    lastMapMiniPercentage,
    isMapModalOpen,
    timelineHover.active,
    timelineHover.yearsAgo,
    lastTimelineYearsAgo,
    viewStart,
    viewEnd
  ])

  const hoveredTimelineYear = useMemo(() => {
    const yearsAgo = timelineHover.active
      ? timelineHover.yearsAgo
      : lastTimelineYearsAgo
    if (!Number.isFinite(yearsAgo)) return null
    return Math.round(CURRENT_YEAR - yearsAgo)
  }, [timelineHover.active, timelineHover.yearsAgo, lastTimelineYearsAgo])

  const lifeExpectancyWorld = useMemo(() => {
    if (!Number.isFinite(hoveredTimelineYear)) return null
    const worldSeries = lifeExpectancyByEntity.get(LIFE_EXPECTANCY_WORLD_ENTITY)
    const worldYears = lifeExpectancyYearsByEntity.get(LIFE_EXPECTANCY_WORLD_ENTITY) || []
    return getValueAtOrBeforeYear(worldSeries, worldYears, hoveredTimelineYear)
  }, [hoveredTimelineYear, lifeExpectancyByEntity, lifeExpectancyYearsByEntity])

  const lifeExpectancyTooltipRows = useMemo(() => {
    if (!Number.isFinite(hoveredTimelineYear)) return []
    return LIFE_EXPECTANCY_CONTINENTS.map((continent) => {
      const continentSeries = lifeExpectancyByEntity.get(continent)
      const continentYears = lifeExpectancyYearsByEntity.get(continent) || []
      const entry = getValueAtOrBeforeYear(continentSeries, continentYears, hoveredTimelineYear)
      return {
        name: continent,
        value: entry ? formatLifeExpectancy(entry.value) : 'N/A'
      }
    })
  }, [hoveredTimelineYear, lifeExpectancyByEntity, lifeExpectancyYearsByEntity])

  const populationWorld = useMemo(() => {
    if (!Number.isFinite(hoveredTimelineYear)) return { state: 'idle' }
    if (hoveredTimelineYear > POPULATION_MAX_YEAR) return { state: 'na_after_2022' }
    const entry = getValueAtOrBeforeYear(populationWorldByYear, populationYears, hoveredTimelineYear)
    if (!entry) return { state: 'missing' }
    return {
      state: 'ready',
      year: entry.year,
      value: entry.value
    }
  }, [hoveredTimelineYear, populationWorldByYear, populationYears])

  const populationTooltipRows = useMemo(() => {
    if (populationWorld.state !== 'ready') return []
    const regionValues = populationRegionsByYear[String(populationWorld.year)] || {}
    return MADDISON_REGION_ORDER.map((regionName) => {
      const value = regionValues[regionName]
      return {
        name: regionName,
        value: Number.isFinite(value) ? formatPopulationCompact(value) : 'N/A'
      }
    })
  }, [populationWorld, populationRegionsByYear])

  const mapFrameMa = useMemo(() => {
    const rawFrame = mapYearsAgo / 1e6
    return Math.min(GEO_MAP_MAX_MA, Math.max(GEO_MAP_MIN_MA, rawFrame))
  }, [mapYearsAgo])

  const mapAssetBasePath = useMemo(() => {
    const rawBasePath = import.meta.env.BASE_URL || '/'
    return rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`
  }, [])

  const mapVideoSrc = useMemo(() => {
    return `${mapAssetBasePath}gp_plates_export/rev_seq_30fps_scrub.mp4`
  }, [mapAssetBasePath])

  const mapVideoTimeSeconds = useMemo(() => {
    const frameIndex = GEO_MAP_MAX_MA - mapFrameMa
    const normalizedFrame = Math.max(0, Math.min(GEO_MAP_FRAME_COUNT - 1, frameIndex))
    return normalizedFrame / GEO_MAP_VIDEO_FPS
  }, [mapFrameMa])

  const syncVideoTime = useCallback((videoElement, targetSeconds) => {
    if (!videoElement || !Number.isFinite(targetSeconds)) return
    const safeDuration = Number.isFinite(videoElement.duration) && videoElement.duration > 0
      ? videoElement.duration
      : GEO_MAP_VIDEO_DURATION_SECONDS
    const clampedTime = Math.max(0, Math.min(safeDuration, targetSeconds))
    if (Math.abs(videoElement.currentTime - clampedTime) > GEO_MAP_VIDEO_FRAME_TIME * 0.25) {
      videoElement.currentTime = clampedTime
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!isHeaderExpanded && !isMapModalOpen) return undefined

    const frameId = window.requestAnimationFrame(() => {
      if (isHeaderExpanded) {
        syncVideoTime(inlineMapVideoRef.current, mapVideoTimeSeconds)
      }
      if (isMapModalOpen) {
        syncVideoTime(modalMapVideoRef.current, mapVideoTimeSeconds)
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHeaderExpanded, isMapModalOpen, mapVideoTimeSeconds, syncVideoTime])

  useEffect(() => {
    if (!isMapModalOpen || typeof window === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsMapModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)
    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isMapModalOpen])

  useEffect(() => {
    if (isMapModalOpen) return
    setMapMiniHover({ active: false, percentage: 0 })
    setLastMapMiniPercentage(null)
  }, [isMapModalOpen])

  const handleMapMiniTimelineMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const x = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setMapMiniHover({ active: true, percentage })
    setLastMapMiniPercentage(percentage)
  }, [])

  const handleMapMiniTimelineLeave = useCallback(() => {
    setMapMiniHover((prev) => ({ ...prev, active: false }))
  }, [])

  const ghostMarkerEvent = useMemo(() => {
    if (!ghostPlacement || !gameGhostEvent) return null
    return {
      ...gameGhostEvent,
      id: `ghost-${gameGhostEvent.id}`,
      isSpan: ghostPlacement.isSpan,
      startPos: ghostPlacement.startPos,
      endPos: ghostPlacement.endPos,
      spanLaneRing: 1,
      spanLaneDirection: -1,
      pointLaneRing: 1,
      pointLaneDirection: -1
    }
  }, [ghostPlacement, gameGhostEvent])

  const persistedGuessMarkerEvents = useMemo(() => {
    if (!Array.isArray(gameGuessMarkers) || gameGuessMarkers.length === 0) return []

    return gameGuessMarkers
      .map((marker) => {
        const sourceEvent = marker.event || gameGhostEvent || gameReveal?.event
        if (!sourceEvent) return null

        const placement = buildGhostPlacement(sourceEvent, marker.yearsAgo)
        if (!placement) return null

        return {
          ...sourceEvent,
          title: marker.displayTitle || sourceEvent.title,
          id: `persisted-guess-${marker.id}`,
          isSpan: placement.isSpan,
          startPos: placement.startPos,
          endPos: placement.endPos,
          spanLaneRing: marker.laneRing || 1,
          spanLaneDirection: marker.laneDirection || 1,
          pointLaneRing: marker.laneRing || 1,
          pointLaneDirection: marker.laneDirection || 1,
          _markerColor: marker.color || null,
          _overlayClass: marker.overlayClass || 'game-overlay-guess'
        }
      })
      .filter(Boolean)
  }, [gameGuessMarkers, gameGhostEvent, gameReveal, buildGhostPlacement])

  const actualMarkerEvent = useMemo(() => {
    if (!gameActualMarker) return null
    const sourceEvent = gameActualMarker.event || gameReveal?.event || gameGhostEvent
    if (!sourceEvent) return null

    const startYearsAgo = eventToYearsAgo(sourceEvent)
    const endYearsAgo = eventEndToYearsAgo(sourceEvent)
    const isSpan = endYearsAgo !== null && endYearsAgo !== undefined
    const startPos = yearToLinearPosition(startYearsAgo, viewStart, viewEnd)
    const endPos = isSpan ? yearToLinearPosition(endYearsAgo, viewStart, viewEnd) : null

    return {
      ...sourceEvent,
      title: gameActualMarker.displayTitle || sourceEvent.title,
      id: `actual-marker-${gameActualMarker.id || sourceEvent.id}`,
      isSpan,
      startPos,
      endPos,
      spanLaneRing: 1,
      spanLaneDirection: -1,
      pointLaneRing: 1,
      pointLaneDirection: -1,
      _markerColor: gameActualMarker.color || null,
      _overlayClass: gameActualMarker.overlayClass || 'game-overlay-actual'
    }
  }, [gameActualMarker, gameReveal, gameGhostEvent, viewStart, viewEnd])

  return (
    <div className="history-arrow-container">
      <div className="timeline-header-panel">
        <button
          type="button"
          className="timeline-header-toggle"
          onClick={() => setIsHeaderExpanded((prev) => !prev)}
          aria-expanded={isHeaderExpanded}
          aria-controls="timeline-header-content"
        >
          <span>{isHeaderExpanded ? 'Hide timeline controls' : 'Show timeline controls'}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isHeaderExpanded ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
          </svg>
        </button>

        {isHeaderExpanded && (
          <div id="timeline-header-content" className="timeline-header has-inline-map">
            <div className="inline-geological-map">
              <button
                type="button"
                className="inline-geological-map-trigger"
                onClick={() => setIsMapModalOpen(true)}
                aria-label="Open geological map preview"
              >
                <div className="inline-geological-map-viewport">
                  {!inlineVideoReady && (
                    <div className="inline-geological-map-fallback">Loading map...</div>
                  )}
                  <video
                    ref={inlineMapVideoRef}
                    className="inline-geological-map-video"
                    src={mapVideoSrc}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={() => {
                      setInlineVideoReady(true)
                      syncVideoTime(inlineMapVideoRef.current, mapVideoTimeSeconds)
                    }}
                    onError={() => setInlineVideoReady(false)}
                  />
                </div>
                <div className="inline-geological-map-year">
                  {formatHoverTime(mapYearsAgo)}
                </div>
              </button>
            </div>

            <div className="timeline-title-group">
              <div className="timeline-title-row">
                <h3 className="timeline-title">{title}</h3>
              </div>
              {titleHint && (
                <span className="timeline-title-hint">{titleHint}</span>
              )}
              <div className="timeline-demographics">
                <div className="timeline-demographic-item" role="note" aria-label="World life expectancy at hovered timeline year">
                  <span className="demographic-label">Life expectancy</span>
                  <span className="demographic-value">
                    {!Number.isFinite(hoveredTimelineYear)
                      ? 'Hover timeline'
                      : lifeExpectancyWorld
                        ? formatLifeExpectancy(lifeExpectancyWorld.value)
                        : 'N/A'}
                  </span>
                  <span className="demographic-year">
                    {lifeExpectancyWorld ? `${lifeExpectancyWorld.year}` : '\u00a0'}
                  </span>
                  <div className="demographic-tooltip" role="tooltip">
                    <div className="demographic-tooltip-title">Continents</div>
                    {!Number.isFinite(hoveredTimelineYear) && (
                      <div className="demographic-tooltip-empty">Hover timeline to inspect values.</div>
                    )}
                    {Number.isFinite(hoveredTimelineYear) && lifeExpectancyTooltipRows.map((row) => (
                      <div key={row.name} className="demographic-tooltip-row">
                        <span>{row.name}</span>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                    <div className="demographic-tooltip-footnote">
                      Low historical life expectancy does not mean everyone died young; high child mortality lowered the average.
                    </div>
                  </div>
                </div>

                <div className="timeline-demographic-item" role="note" aria-label="World population at hovered timeline year">
                  <span className="demographic-label">World population</span>
                  <span className="demographic-value">
                    {!Number.isFinite(hoveredTimelineYear)
                      ? 'Hover timeline'
                      : populationWorld.state === 'na_after_2022'
                        ? 'N/A'
                        : populationWorld.state === 'ready'
                          ? formatPopulationCompact(populationWorld.value)
                          : 'N/A'}
                  </span>
                  <span className="demographic-year">
                    {populationWorld.state === 'ready' ? `${populationWorld.year}` : '\u00a0'}
                  </span>
                  <div className="demographic-tooltip" role="tooltip">
                    <div className="demographic-tooltip-title">Maddison regions</div>
                    {populationWorld.state === 'na_after_2022' && (
                      <div className="demographic-tooltip-empty">No data after 2022.</div>
                    )}
                    {populationWorld.state === 'ready' && (
                      <>
                        {populationTooltipRows.map((row) => (
                          <div key={row.name} className="demographic-tooltip-row">
                            <span>{row.name}</span>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
                        <div className="demographic-tooltip-footnote">
                          Unit: people (from thousands in source)
                        </div>
                      </>
                    )}
                    {populationWorld.state === 'missing' && (
                      <div className="demographic-tooltip-empty">No population value for this hover year.</div>
                    )}
                    {populationWorld.state === 'idle' && (
                      <div className="demographic-tooltip-empty">Hover timeline to inspect values.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="timeline-attribution">
                <span>
                  Life expectancy: Riley (2005); Zijdeman et al. (2015); HMD (2025); UN WPP (2024), processed by OWID.
                </span>
                <span>
                  Population: Agnus Maddison,{' '}
                  <a href="https://ghdx.healthdata.org/organizations/groningen-growth-and-development-centre-university-groningen" target="_blank" rel="noreferrer">
                    Groningen Growth and Development Centre, University of Groningen
                  </a>
                  {' '}·{' '}
                  <a href="https://ghdx.healthdata.org/record/statistics-world-population-gdp-and-capita-gdp-1-2008-ad" target="_blank" rel="noreferrer">
                    Statistics on World Population, GDP, and Per Capita GDP 1-2008 AD
                  </a>
                  .
                  {populationWorld.state === 'ready' && (
                    <> Current hover: {formatPopulationFull(populationWorld.value)} ({populationWorld.year}).</>
                  )}
                </span>
              </div>
            </div>
            <div className="timeline-actions">
              <form className="center-input-form" onSubmit={handleCenterInputSubmit}>
                <div className="center-input-row">
                  <select
                    className="center-input-type"
                    value={centerInputType}
                    onChange={(e) => {
                      setCenterInputType(e.target.value)
                      setCenterInputError('')
                    }}
                  >
                    <option value="date">Date</option>
                    <option value="astronomical">Astronomical year</option>
                  </select>
                  <input
                    className="center-input-field"
                    type={centerInputType === 'date' ? 'date' : 'text'}
                    value={centerInputValue}
                    onChange={(e) => {
                      setCenterInputValue(e.target.value)
                      setCenterInputError('')
                    }}
                    placeholder={centerInputType === 'date' ? '' : 'e.g. 66000000'}
                  />
                  <button type="submit" className="center-input-btn">
                    Center
                  </button>
                </div>
                {centerInputError && <span className="center-input-error">{centerInputError}</span>}
              </form>
              {showRandomEventButton && (
                <button className="random-event-btn" onClick={handleRandomEventSelect}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 8l4-4 4 4-4 4-4-4z" />
                    <path d="M12 16l4-4 4 4-4 4-4-4z" />
                    <path d="M9 15l6-6" />
                  </svg>
                  Random Event
                </button>
              )}
              <button className="reset-view-btn" onClick={handleReset}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reset View
              </button>
            </div>
          </div>
        )}
      </div>

      <div 
        className="timeline-wrapper"
        ref={timelineRef}
        style={timelineLayoutStyle}
      >
        <motion.div
          className="timeline-content"
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Main Arrow Line */}
          <div className="arrow-line">
            <div className="arrow-body" />
            <div className="arrow-head">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l8 8-8 8V4z" />
              </svg>
            </div>
            {manualCenterLabel && (
              <div className="arrow-center-indicator">
                <div className="arrow-center-dot" />
                <span className="arrow-center-label">{manualCenterLabel}</span>
              </div>
            )}
          </div>

          {/* Timeline Ticks */}
          <div className="timeline-ticks">
            {timelineTicks.map((tick, index) => (
              <div
                key={index}
                className="timeline-tick"
                style={{ left: `${tick.position}%` }}
              >
                <div className="tick-mark" />
                <span className="tick-label">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>

          {/* Event Markers */}
          <div 
            ref={eventsLayerRef}
            className="events-layer"
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            onClick={handleTimelineClick}
          >
            {subFocusParentId && focusParentLaneEvent ? (
              <div
                className="timeline-sub-focus"
                onMouseLeave={handleExitSubFocus}
              >
                {(() => {
                  const event = focusParentLaneEvent
                  const focusedParentEvent = {
                    ...event,
                    // During sub-focus, pin the parent span just above the arrow baseline
                    // so child points visually connect to the main span.
                    spanLaneRing: 1,
                    spanLaneDirection: -1
                  }
                  const eventLabelColor = labelColorMap.get(event.label) || null
                  const labelLaneBudget = Math.min(
                    event.spanEffectiveLaneCount,
                    isIphoneViewport ? IPHONE_VISIBLE_SPAN_LABEL_LANES : DESKTOP_VISIBLE_SPAN_LABEL_LANES
                  )
                  const shouldShowLabel = event.spanLaneIndex < labelLaneBudget
                  return (
                    <EventMarker
                      key={event.id}
                      event={focusedParentEvent}
                      onHover={handleEventHover}
                      onClick={onEventClick}
                      isHovered={hoveredEvent?.id === event.id}
                      isSelected={selectedEvent?.id === event.id}
                      showLabel={shouldShowLabel}
                      labelColor={eventLabelColor}
                    />
                  )
                })()}
                {positionedSubEvents.map((event) => {
                  const eventLabelColor = labelColorMap.get(event.label) || null
                  const labelLaneBudget = Math.min(
                    event.pointEffectiveLaneCount,
                    isIphoneViewport ? IPHONE_VISIBLE_POINT_LABEL_LANES : DESKTOP_VISIBLE_POINT_LABEL_LANES
                  )
                  const shouldShowLabel = event.pointLaneIndex < labelLaneBudget
                  return (
                    <EventMarker
                      key={event.id}
                      event={event}
                      onHover={handleEventHover}
                      onClick={onEventClick}
                      isHovered={hoveredEvent?.id === event.id}
                      isSelected={selectedEvent?.id === event.id}
                      showLabel={shouldShowLabel}
                      labelColor={eventLabelColor}
                      className={`event-point--sub-focus ${
                        event.pointLaneDirection < 0 ? 'event-point--sub-focus-above' : 'event-point--sub-focus-below'
                      }`}
                    />
                  )
                })}
              </div>
            ) : !subFocusParentId ? (
              laneAwareEvents.map(event => {
                const eventLabelColor = labelColorMap.get(event.label) || null
                const labelLaneBudget = event.isSpan
                  ? Math.min(
                      event.spanEffectiveLaneCount,
                      isIphoneViewport ? IPHONE_VISIBLE_SPAN_LABEL_LANES : DESKTOP_VISIBLE_SPAN_LABEL_LANES
                    )
                  : Math.min(
                      event.pointEffectiveLaneCount,
                      isIphoneViewport ? IPHONE_VISIBLE_POINT_LABEL_LANES : DESKTOP_VISIBLE_POINT_LABEL_LANES
                    )
                const shouldShowLabel = event.isSpan
                  ? event.spanLaneIndex < labelLaneBudget
                  : event.pointLaneIndex < labelLaneBudget

                return (
                  <EventMarker
                    key={event.id}
                    event={event}
                    onHover={handleEventHover}
                    onClick={onEventClick}
                    isHovered={hoveredEvent?.id === event.id}
                    isSelected={selectedEvent?.id === event.id}
                    showLabel={shouldShowLabel}
                    labelColor={eventLabelColor}
                    spanLongHoverMs={event.isSpan ? SPAN_SUB_FOCUS_HOVER_MS : null}
                    onSpanLongHoverComplete={event.isSpan ? handleSpanSubFocusComplete : null}
                  />
                )
              })
            ) : null}
            {ghostMarkerEvent && (
              <EventMarker
                event={ghostMarkerEvent}
                onHover={() => {}}
                onClick={null}
                isHovered
                isSelected={false}
                showLabel
                disablePointerEvents
                className="game-overlay-ghost"
                labelColor={labelColorMap.get(ghostMarkerEvent.label) || null}
                markerColor={gameGhostColor}
              />
            )}
            {persistedGuessMarkerEvents.map((markerEvent) => (
              <EventMarker
                key={markerEvent.id}
                event={markerEvent}
                onHover={() => {}}
                onClick={null}
                isHovered
                isSelected={false}
                showLabel
                disablePointerEvents
                className={markerEvent._overlayClass}
                labelColor={labelColorMap.get(markerEvent.label) || null}
                markerColor={markerEvent._markerColor}
              />
            ))}
            {actualMarkerEvent && (
              <EventMarker
                key={actualMarkerEvent.id}
                event={actualMarkerEvent}
                onHover={() => {}}
                onClick={null}
                isHovered
                isSelected={false}
                showLabel
                disablePointerEvents
                className={actualMarkerEvent._overlayClass}
                labelColor={labelColorMap.get(actualMarkerEvent.label) || null}
                markerColor={actualMarkerEvent._markerColor}
              />
            )}
          </div>

          {/* View range labels */}
          <div className="view-range-labels">
            <span className="range-label past">
              {formatYearsAgoShort(viewEnd)} ago
            </span>
            <span className="range-label present">
              {formatYearsAgoShort(viewStart)} ago
            </span>
          </div>

          {/* Hover time indicator */}
          {timelineHover.active && (
            <motion.div 
              className="timeline-hover-indicator"
              style={{ left: timelineHover.x }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <div className="hover-line" />
              <span className="hover-time">{formatHoverTime(timelineHover.yearsAgo)}</span>
              {hoveredEvent && (
                <span className="hover-time-secondary">
                  {getHoveredEventElapsedLines(hoveredEvent, timelineHover.yearsAgo).map((line, index) => (
                    <span key={`${index}-${line}`} className="hover-time-secondary-line">
                      {line}
                    </span>
                  ))}
                </span>
              )}
            </motion.div>
          )}
        </motion.div>

      </div>

      {/* Logarithmic Minimap */}
      <LogarithmicMinimap
        viewStart={viewStart}
        viewEnd={viewEnd}
        onViewChange={handleViewChange}
        events={minimapEvents}
        selectedEvent={selectedEvent}
        totalMin={DEFAULT_MIN_YEARS}
        totalMax={DEFAULT_MAX_YEARS}
        labelColorMap={labelColorMap}
      />

      {isMapModalOpen && (
        <motion.div
          className="geological-map-modal-backdrop"
          onClick={() => setIsMapModalOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="geological-map-modal"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              className="geological-map-modal-close"
              onClick={() => setIsMapModalOpen(false)}
              aria-label="Close geological map"
            >
              ×
            </button>
            <div className="geological-map-modal-viewport">
              {!modalVideoReady && (
                <div className="geological-map-modal-fallback">Loading map...</div>
              )}
              <video
                ref={modalMapVideoRef}
                className="geological-map-modal-video"
                src={mapVideoSrc}
                muted
                playsInline
                preload="auto"
                onLoadedData={() => {
                  setModalVideoReady(true)
                  syncVideoTime(modalMapVideoRef.current, mapVideoTimeSeconds)
                }}
                onError={() => setModalVideoReady(false)}
              />
            </div>
            <div className="geological-map-modal-year">
              {formatHoverTime(mapYearsAgo)}
            </div>
            <div
              className="inline-map-mini-timeline"
              onMouseMove={handleMapMiniTimelineMove}
              onMouseLeave={handleMapMiniTimelineLeave}
              aria-label="Geological map mini timeline"
            >
              <div className="inline-map-mini-track">
                <div className="inline-map-mini-body" />
                <div className="inline-map-mini-head" />
                <div
                  className="inline-map-mini-hover"
                  style={{ left: `${mapMiniHover.active ? mapMiniHover.percentage : (mapFrameMa / GEO_MAP_MAX_MA) * 100}%` }}
                />
              </div>
              <div className="inline-map-mini-labels">
                <span>530 Ma</span>
                <span>0</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

    </div>
  )
})

export default HistoryArrow
