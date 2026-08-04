'use client'

import { useEffect, useState } from 'react'

/**
 * Resolve variáveis CSS para valores computados.
 *
 * Existe porque o Chart.js desenha em `<canvas>`: ao contrário do DOM, o canvas
 * não entende `var(--stage-frio)`. Sem isto, os gráficos seriam o único lugar
 * do sistema com cor hardcoded — e o único que não trocaria junto com o tema.
 *
 * Reage à troca de tema observando a classe `dark` no `<html>`.
 *
 * @example
 *   const c = useCssVars({ bar: '--chart-1', grid: '--line' })
 *   // → { bar: 'oklch(0.575 0.185 254)', grid: 'oklch(0.912 0.006 262)' }
 */
export function useCssVars<T extends Record<string, string>>(vars: T): Record<keyof T, string> {
  const [resolved, setResolved] = useState<Record<keyof T, string>>(
    () => Object.fromEntries(Object.keys(vars).map(k => [k, 'transparent'])) as Record<keyof T, string>,
  )

  // A lista de nomes é estável entre renders; a string evita reexecutar o
  // efeito por causa de um objeto literal novo a cada render do pai.
  const signature = JSON.stringify(vars)

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement)
      const next = Object.fromEntries(
        Object.entries(vars).map(([key, name]) => [key, styles.getPropertyValue(name).trim()]),
      ) as Record<keyof T, string>
      setResolved(next)
    }

    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return resolved
}
