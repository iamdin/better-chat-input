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

  test('fires after a CJK char with no whitespace (spec §4.6 boundary)', () => {
    const m = matchTrigger('你好@张', triggers)
    expect(m?.char).toBe('@')
    expect(m?.query).toBe('张')
    expect(m?.matched).toBe('@张')
  })

  test('does NOT fire when @ directly follows an ASCII word char', () => {
    expect(matchTrigger('hi@', triggers)).toBeNull()
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

  test('charConfig stopOnWhitespace ends the query at a space', () => {
    const cfg = { '/': { stopOnWhitespace: true } }
    expect(matchTrigger('/help', ['/'], cfg)?.query).toBe('help')
    // The query stops at the space, so "/help me" no longer matches as one run.
    expect(matchTrigger('/help me', ['/'], cfg)).toBeNull()
  })

  test('charConfig pattern fully overrides the default matcher', () => {
    const cfg = { ':': { pattern: /(?:^|\s):([\w+]*)$/u } }
    expect(matchTrigger('feeling :smile', [':'], cfg)?.query).toBe('smile')
    // The custom pattern requires whitespace/start before ':', so ":(" wins nothing here.
    expect(matchTrigger('a:smile', [':'], cfg)).toBeNull()
  })
})
