import { describe, expect, test } from 'bun:test'
import { matchTrigger } from './match'

const triggers = ['@']

describe('matchTrigger', () => {
  test('matches a trigger at the start of input', () => {
    const m = matchTrigger('@ali', triggers)
    expect(m).not.toBeNull()
    expect(m?.char).toBe('@')
    expect(m?.query).toBe('ali')
    expect(m?.matched).toBe('@ali')
  })

  test('matches a trigger after whitespace', () => {
    const m = matchTrigger('hey @bob', triggers)
    expect(m?.query).toBe('bob')
    expect(m?.matched).toBe('@bob')
  })

  test('matches a bare trigger with empty query', () => {
    const m = matchTrigger('hello @', triggers)
    expect(m?.query).toBe('')
    expect(m?.matched).toBe('@')
  })

  test('matches CJK queries', () => {
    const m = matchTrigger('找 @张三', triggers)
    expect(m?.query).toBe('张三')
  })

  test('keeps spaces so multi-word names work', () => {
    const m = matchTrigger('@Team Alpha', triggers)
    expect(m?.query).toBe('Team Alpha')
  })

  test('anchors to the most recent trigger', () => {
    const m = matchTrigger('@alice @bo', triggers)
    expect(m?.query).toBe('bo')
    expect(m?.matched).toBe('@bo')
  })

  test('does NOT match when an email-like @ is mid-word (no boundary)', () => {
    expect(matchTrigger('mail me at foo@bar', triggers)).toBeNull()
  })

  test('does NOT match plain text with no trigger', () => {
    expect(matchTrigger('just words', triggers)).toBeNull()
  })

  test('returns the first matching char among several triggers', () => {
    const m = matchTrigger('/hel', ['@', '/'])
    expect(m?.char).toBe('/')
    expect(m?.query).toBe('hel')
  })
})
