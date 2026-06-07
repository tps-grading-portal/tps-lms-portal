'use client'

import { useMemo, useState } from 'react'
import type { RoadmapEvent } from './actions'
import type { SyllabusEventStatus } from '@prisma/client'

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W   = 124
const NODE_H   = 40
const COL_GAP  = 110   // horizontal space between columns (for edge curves)
const ROW_GAP  = 14
const PAD      = 24

const STATUS_COLORS: Record<SyllabusEventStatus | 'none', { stroke: string; fill: string }> = {
  LOCKED:      { stroke: '#9ca3af', fill: '#f9fafb' },
  UPCOMING:    { stroke: '#60a5fa', fill: '#eff6ff' },
  IN_PROGRESS: { stroke: '#fbbf24', fill: '#fffbeb' },
  COMPLETED:   { stroke: '#22c55e', fill: '#f0fdf4' },
  REVIEW:      { stroke: '#f87171', fill: '#fef2f2' },
  none:        { stroke: '#d1d5db', fill: '#ffffff' },
}

type Node = {
  event: RoadmapEvent
  x: number
  y: number
  level: number
}

function computeLevels(events: RoadmapEvent[]): Map<string, number> {
  const byId = new Map(events.map(e => [e.id, e]))
  const levels = new Map<string, number>()
  function levelOf(id: string, stack: Set<string>): number {
    const cached = levels.get(id)
    if (cached !== undefined) return cached
    if (stack.has(id)) return 0
    const event = byId.get(id)
    if (!event) return 0
    stack.add(id)
    const prereqLevels = event.prerequisiteIds
      .filter(pid => byId.has(pid))
      .map(pid => levelOf(pid, stack))
    stack.delete(id)
    const level = prereqLevels.length === 0 ? 0 : Math.max(...prereqLevels) + 1
    levels.set(id, level)
    return level
  }
  for (const e of events) levelOf(e.id, new Set())
  return levels
}

/**
 * Spiderweb prerequisite graph — SVG dependency web. Nodes are positioned in
 * topological columns; curved edges connect each course to everything it
 * unlocks. Click a node to open its course page; hover highlights its web.
 */
export function PrereqGraph({ events }: { events: RoadmapEvent[] }) {
  const [hoverId,    setHoverId]    = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // When a course is selected, collapse the graph down to just its prereq
  // trace (the course + every ancestor feeding it) and re-lay it out compactly
  // so the whole flow fits on screen instead of spreading across the full web.
  const visibleEvents = useMemo(() => {
    if (!selectedId) return events
    const byId = new Map(events.map(e => [e.id, e]))
    if (!byId.has(selectedId)) return events
    const keep = new Set<string>()
    const walk = (id: string) => {
      if (keep.has(id)) return
      keep.add(id)
      const ev = byId.get(id)
      if (!ev) return
      for (const pid of ev.prerequisiteIds) {
        if (byId.has(pid)) walk(pid)
      }
    }
    walk(selectedId)
    return events.filter(e => keep.has(e.id))
  }, [events, selectedId])

  const { nodes, edges, width, height } = useMemo(() => {
    const events = visibleEvents
    const levels = computeLevels(events)
    const idSet  = new Set(events.map(e => e.id))

    // Bucket into columns
    const columns = new Map<number, RoadmapEvent[]>()
    for (const e of events) {
      const lvl = levels.get(e.id) ?? 0
      if (!columns.has(lvl)) columns.set(lvl, [])
      columns.get(lvl)!.push(e)
    }
    for (const list of columns.values()) {
      list.sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }))
    }

    const maxLevel = Math.max(0, ...columns.keys())
    const maxRows  = Math.max(1, ...[...columns.values()].map(c => c.length))

    const nodeById = new Map<string, Node>()
    const nodes: Node[] = []
    for (const [level, list] of columns) {
      list.forEach((event, row) => {
        const node: Node = {
          event,
          level,
          x: PAD + level * (NODE_W + COL_GAP),
          y: PAD + row * (NODE_H + ROW_GAP),
        }
        nodes.push(node)
        nodeById.set(event.id, node)
      })
    }

    // Edges: prereq → event (only when both visible)
    const edges: { from: Node; to: Node }[] = []
    for (const e of events) {
      const to = nodeById.get(e.id)
      if (!to) continue
      for (const pid of e.prerequisiteIds) {
        if (!idSet.has(pid)) continue
        const from = nodeById.get(pid)
        if (from) edges.push({ from, to })
      }
    }

    return {
      nodes,
      edges,
      width:  PAD * 2 + (maxLevel + 1) * NODE_W + maxLevel * COL_GAP,
      height: PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP,
    }
  }, [visibleEvents])

  // Selected: the graph is already collapsed to the trace — highlight all of
  // it. Hover (when nothing is selected): the full connected web both ways.
  const highlight = useMemo(() => {
    if (selectedId) {
      return {
        edges: new Set(edges.map((_, i) => i)),
        nodes: new Set(nodes.map(n => n.event.id)),
      }
    }
    if (!hoverId) return null

    const connectedEdges = new Set<number>()
    const connectedNodes = new Set<string>([hoverId])

    let changed = true
    while (changed) {
      changed = false
      edges.forEach((edge, i) => {
        const fromId = edge.from.event.id
        const toId   = edge.to.event.id
        if ((connectedNodes.has(toId) || connectedNodes.has(fromId)) && !connectedEdges.has(i)) {
          connectedEdges.add(i)
          if (!connectedNodes.has(fromId)) { connectedNodes.add(fromId); changed = true }
          if (!connectedNodes.has(toId))   { connectedNodes.add(toId);   changed = true }
        }
      })
    }
    return { edges: connectedEdges, nodes: connectedNodes }
  }, [selectedId, hoverId, edges, nodes])

  if (events.length === 0) {
    return <div className="card text-center py-10 text-gray-400">No events match your filters.</div>
  }

  return (
    <div className="card p-0 overflow-auto w-full" style={{ height: 'calc(100vh - 16rem)', minHeight: 420 }}>
      <svg width={width} height={height} className="block">
        {/* Edges */}
        {edges.map((edge, i) => {
          const x1 = edge.from.x + NODE_W
          const y1 = edge.from.y + NODE_H / 2
          const x2 = edge.to.x
          const y2 = edge.to.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          const isHl = highlight?.edges.has(i)
          const dimmed = highlight && !isHl
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={isHl ? '#f97316' : '#cbd5e1'}
              strokeWidth={isHl ? 2 : 1.25}
              opacity={dimmed ? 0.15 : isHl ? 1 : 0.6}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const colors = STATUS_COLORS[node.event.status ?? 'none']
          const isHl   = highlight?.nodes.has(node.event.id)
          const dimmed = highlight && !isHl
          return (
            <g
              key={node.event.id}
              transform={`translate(${node.x}, ${node.y})`}
              opacity={dimmed ? 0.15 : 1}
              className="cursor-pointer"
              onMouseEnter={() => setHoverId(node.event.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() =>
                // First click traces the path to this course; second click clears
                setSelectedId(prev => (prev === node.event.id ? null : node.event.id))
              }
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={colors.fill}
                stroke={selectedId === node.event.id || (isHl && hoverId === node.event.id) ? '#f97316' : colors.stroke}
                strokeWidth={selectedId === node.event.id ? 3 : isHl && hoverId === node.event.id ? 2.5 : 1.5}
              />
              <text x={NODE_W / 2} y={17} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={700} fill="#1e2a44">
                {node.event.courseCode}
              </text>
              <text x={NODE_W / 2} y={31} textAnchor="middle" fontSize={8.5} fill="#6b7280">
                {node.event.title.length > 22 ? node.event.title.slice(0, 21) + '…' : node.event.title}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="sticky left-0 bottom-0 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 bg-white flex items-center gap-3">
        {selectedId ? (
          <>
            <span>Collapsed to the prereq flow for the selected course — click it again to show the full web</span>
            <button
              onClick={() => setSelectedId(null)}
              className="text-tps-orange font-semibold hover:underline shrink-0"
            >
              Show all flows
            </button>
          </>
        ) : (
          'Hover to preview a course’s web · click a course to collapse down to its prereq flow'
        )}
      </div>
    </div>
  )
}
