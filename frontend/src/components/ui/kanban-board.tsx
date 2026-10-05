import React, { useCallback, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

/* ═══════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════ */

const TAG_VARIANTS: Record<string, { bg: string; color: string }> = {
  feature: { bg: "rgba(59,130,246,0.10)", color: "#2563eb" },
  bug: { bg: "rgba(239,68,68,0.10)", color: "#dc2626" },
  design: { bg: "rgba(168,85,247,0.10)", color: "#9333ea" },
  done: { bg: "rgba(16,185,129,0.10)", color: "#059669" },
  improvement: { bg: "rgba(245,158,11,0.10)", color: "#d97706" },
  docs: { bg: "rgba(6,182,212,0.10)", color: "#0891b2" },
  LOW: { bg: "rgba(100,116,139,0.10)", color: "#64748b" },
  MEDIUM: { bg: "rgba(59,130,246,0.10)", color: "#2563eb" },
  HIGH: { bg: "rgba(245,158,11,0.10)", color: "#d97706" },
  URGENT: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
}

const COLUMN_META: Record<string, { icon: React.ReactNode }> = {
  TODO: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  todo: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  IN_PROGRESS: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  "in-progress": {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  REVIEW: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#8b5cf6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  review: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#8b5cf6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  DONE: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  done: {
    icon: (
      <svg aria-hidden="true" fill="none" height="13" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
}

export type TagVariant = keyof typeof TAG_VARIANTS | string
export type ColumnStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "todo" | "in-progress" | "review" | "done" | string

export type CardTag = {
  label: string
  variant: TagVariant
}

export type Assignee = {
  name: string
  avatar?: string
}

export type CardData = {
  id: string
  title: string
  tags?: CardTag[]
  assignee?: Assignee
  date?: string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string
  description?: string
  position?: number
  [key: string]: any
}

export type ColumnData = {
  id: ColumnStatus
  title: string
  status: ColumnStatus
  cards: CardData[]
}

export type DragState = {
  cardId: string
  fromColumn: ColumnStatus
} | null

type TagProps = {
  label: string
  variant: TagVariant
}

type AvatarProps = {
  src?: string
  name?: string
}

type CardProps = {
  card: CardData
  isDone: boolean
  index: number
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
  onClick?: (card: CardData) => void
}

type DropIndicatorProps = {
  isActive: boolean
}

export type ColumnProps = {
  column: ColumnData
  onDrop: (
    cardId: string,
    fromColumnId: ColumnStatus,
    toColumnId: ColumnStatus
  ) => void
  dragState: DragState
  setDragState: React.Dispatch<React.SetStateAction<DragState>>
  onCardClick?: (card: CardData) => void
}

const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
}

export const gentleSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 26,
}

/* ═══════════════════════════════════════════════════════════════════════
   TAG
   ═══════════════════════════════════════════════════════════════════════ */

function Tag({ label, variant }: TagProps) {
  const v = TAG_VARIANTS[variant] || { bg: "rgba(100,116,139,0.1)", color: "var(--muted-foreground)" }
  return (
    <span
      className="inline-block rounded-[6px] px-[7px] py-[2px] font-semibold text-[10.5px] leading-snug tracking-wide"
      style={{ backgroundColor: v.bg, color: v.color }}
    >
      {label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   AVATAR
   ═══════════════════════════════════════════════════════════════════════ */

function Avatar({ src, name }: AvatarProps) {
  if (src) {
    return (
      <img
        alt={name || ""}
        className="size-[22px] rounded-full object-cover"
        src={src}
        style={{
          outline: "1px solid var(--border)",
          outlineOffset: "-1px",
        }}
      />
    )
  }
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className="flex size-[22px] items-center justify-center rounded-full font-bold text-[9px]"
      style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
    >
      {initials}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   CARD
   ═══════════════════════════════════════════════════════════════════════ */

const cardVariants = {
  initial: { opacity: 0, y: 8, scale: 0.97, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -6, scale: 0.98, filter: "blur(3px)" },
}

function Card({
  card,
  isDone,
  index,
  onDragStart,
  onDragEnd,
  isDragging,
  onClick,
}: CardProps) {
  const shouldReduce = useReducedMotion()
  const tags = card.tags ?? []

  return (
    <motion.div
      animate="animate"
      className="not-prose flex cursor-pointer select-none flex-col gap-1.5 active:cursor-grabbing hover:border-primary/40 border border-transparent transition-colors"
      draggable
      exit="exit"
      initial="initial"
      layout
      layoutId={card.id}
      onClick={() => onClick?.(card)}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      style={{
        borderRadius: 12,
        background: "hsl(var(--card))",
        padding: "10px 12px",
        boxShadow: isDragging
          ? "0 0 0 1px var(--border), 0 12px 32px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.10)"
          : "0 0 0 1px hsl(var(--border)), 0 1px 3px rgba(0,0,0,0.05)",
        opacity: isDone && !isDragging ? 0.6 : 1,
        position: "relative",
        zIndex: isDragging ? 50 : 1,
      }}
      transition={{
        ...gentleSpring,
        delay: shouldReduce ? 0 : index * 0.03,
        layout: springTransition,
      }}
      variants={cardVariants}
      whileHover={{
        y: -2,
        boxShadow:
          "0 0 0 1px hsl(var(--ring)), 0 4px 12px rgba(0,0,0,0.08)",
        transition: { type: "spring", stiffness: 400, damping: 20 },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Tags and Priority */}
      <div className="flex flex-wrap items-center gap-1.5 justify-between">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Tag
              key={`${card.id}-${tag.label}-${tag.variant}`}
              label={tag.label}
              variant={tag.variant}
            />
          ))}
        </div>
        {card.priority && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            card.priority === 'URGENT' ? 'bg-red-500/10 text-red-500 font-bold' :
            card.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-600' :
            card.priority === 'MEDIUM' ? 'bg-blue-500/10 text-blue-600' :
            'bg-slate-500/10 text-slate-500'
          }`}>
            {card.priority}
          </span>
        )}
      </div>

      {/* Title */}
      <div
        className="font-medium text-[13px] leading-snug tracking-tight text-foreground"
        style={{
          textDecoration: isDone ? "line-through" : "none",
          textDecorationColor: isDone ? "hsl(var(--muted-foreground))" : undefined,
          textWrap: "pretty",
        }}
      >
        {card.title}
      </div>

      {/* Footer */}
      <div className="mt-1 flex items-center justify-between pt-1 border-t border-border/40">
        {card.assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={card.assignee.name} src={card.assignee.avatar} />
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{card.assignee.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/60 italic">Unassigned</span>
        )}
        {card.date && (
          <span className="font-medium text-[10.5px] tabular-nums text-muted-foreground">
            {card.date}
          </span>
        )}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   DROP INDICATOR
   ═══════════════════════════════════════════════════════════════════════ */

function DropIndicator({ isActive }: DropIndicatorProps) {
  return (
    <motion.div
      animate={{
        opacity: isActive ? 1 : 0,
        scaleX: isActive ? 1 : 0.3,
      }}
      className="pointer-events-none mx-auto"
      initial={false}
      style={{
        height: 3,
        width: "60%",
        borderRadius: 99,
        background:
          "linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)",
        marginTop: 2,
        marginBottom: 2,
      }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   COLUMN
   ═══════════════════════════════════════════════════════════════════════ */

export function Column({
  column,
  onDrop,
  dragState,
  setDragState,
  onCardClick,
}: ColumnProps) {
  const [dragOver, setDragOver] = useState(false)
  const meta = COLUMN_META[column.status] || COLUMN_META.TODO
  const isDone = column.status === "DONE" || column.status === "done"
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setDragOver(false), 60)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (dragState) {
        onDrop(dragState.cardId, dragState.fromColumn, column.id)
      }
    },
    [dragState, onDrop, column.id]
  )

  return (
    <div className="flex h-full min-h-[500px] min-w-[280px] max-w-[320px] flex-1 flex-col rounded-xl bg-muted/40 p-2.5 border border-border/60">
      {/* Header */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 flex items-center gap-2 px-1"
        initial={{ opacity: 0, y: -4 }}
        transition={{ ...gentleSpring, delay: 0.05 }}
      >
        <span className="p-1 rounded-md bg-background border border-border/50 shadow-xs">
          {meta.icon}
        </span>
        <span className="font-semibold text-sm tracking-tight text-foreground">
          {column.title}
        </span>
        <motion.span
          animate={{ scale: 1, opacity: 1 }}
          className="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-background border border-border/70 text-xs font-semibold tabular-nums text-muted-foreground shadow-xs"
          initial={{ scale: 0.6, opacity: 0 }}
          key={column.cards.length}
          transition={springTransition}
        >
          {column.cards.length}
        </motion.span>
      </motion.div>

      {/* Card list */}
      <motion.div
        animate={{
          backgroundColor: dragOver
            ? "rgba(59,130,246,0.06)"
            : "rgba(0,0,0,0)",
          scale: dragOver ? 1.01 : 1,
        }}
        className="flex min-h-[300px] flex-1 flex-col gap-2 rounded-lg p-1 overflow-y-auto no-scrollbar"
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
      >
        <DropIndicator isActive={dragOver} />

        <AnimatePresence initial={false} mode="popLayout">
          {column.cards.map((card, i) => (
            <Card
              card={card}
              index={i}
              isDone={isDone}
              isDragging={dragState?.cardId === card.id}
              key={card.id}
              onClick={onCardClick}
              onDragEnd={() => setDragState(null)}
              onDragStart={() =>
                setDragState({ cardId: card.id, fromColumn: column.id })
              }
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
