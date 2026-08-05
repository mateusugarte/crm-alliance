import { describe, expect, it } from 'vitest'
import { canViewCommercialResults } from './commercial-results'

describe('canViewCommercialResults', () => {
  it('autoriza administradores, Joao e Lucas', () => {
    expect(canViewCommercialResults('adm', 'qualquer@alliance.com.br')).toBe(true)
    expect(canViewCommercialResults('corretor', 'joao@alliance.com.br')).toBe(true)
    expect(canViewCommercialResults('corretor', 'LUCAS@ALLIANCE.COM.BR')).toBe(true)
  })

  it('bloqueia Jaque, Isabela e demais corretores', () => {
    expect(canViewCommercialResults('corretor', 'jaquecorretora@alliance.com')).toBe(false)
    expect(canViewCommercialResults('corretor', 'isabelacorretora@alliance.com')).toBe(false)
    expect(canViewCommercialResults('corretor', 'outro@alliance.com.br')).toBe(false)
  })
})
