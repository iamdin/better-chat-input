import { describe, expect, test } from 'bun:test'
import { matchTrigger } from './match'
import type { MentionConfig } from './types'

const userConfig: MentionConfig = {
  trigger: '@',
  tagType: 'user',
  search: () => [],
}
const configs = [userConfig]

describe('matchTrigger', () => {
  test('matches a trigger at the start of input', () => {
    const m = matchTrigger('@ali', configs)
    expect(m).not.toBeNull()
    expect(m?.query).toBe('ali')
    expect(m?.matched).toBe('@ali')
    expect(m?.config.tagType).toBe('user')
  })

  test('matches a trigger after whitespace', () => {
    const m = matchTrigger('hey @bob', configs)
    expect(m?.query).toBe('bob')
    expect(m?.matched).toBe('@bob')
  })

  test('matches a bare trigger with empty query', () => {
    const m = matchTrigger('hello @', configs)
    expect(m?.query).toBe('')
    expect(m?.matched).toBe('@')
  })

  test('matches CJK queries', () => {
    const m = matchTrigger('找 @张三', configs)
    expect(m?.query).toBe('张三')
  })

  test('does NOT match when an email-like @ is mid-word (no boundary)', () => {
    expect(matchTrigger('mail me at foo@bar', configs)).toBeNull()
  })

  test('does NOT match once a space follows the query', () => {
    expect(matchTrigger('@bob ', configs)).toBeNull()
  })

  test('does NOT match plain text with no trigger', () => {
    expect(matchTrigger('just words', configs)).toBeNull()
  })

  test('honors a different trigger char', () => {
    const slash: MentionConfig = { trigger: '/', tagType: 'command', search: () => [] }
    const m = matchTrigger('/hel', [slash])
    expect(m?.query).toBe('hel')
    expect(m?.config.tagType).toBe('command')
  })
})
