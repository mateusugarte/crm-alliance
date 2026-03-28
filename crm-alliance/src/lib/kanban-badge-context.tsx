'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface KanbanBadgeContextValue {
  badge: number
  increment: () => void
  clear: () => void
}

const KanbanBadgeContext = createContext<KanbanBadgeContextValue>({
  badge: 0,
  increment: () => {},
  clear: () => {},
})

export function KanbanBadgeProvider({ children }: { children: React.ReactNode }) {
  const [badge, setBadge] = useState(0)
  const increment = useCallback(() => setBadge(n => n + 1), [])
  const clear = useCallback(() => setBadge(0), [])

  return (
    <KanbanBadgeContext.Provider value={{ badge, increment, clear }}>
      {children}
    </KanbanBadgeContext.Provider>
  )
}

export function useKanbanBadge() {
  return useContext(KanbanBadgeContext)
}
