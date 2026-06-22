import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ChatContent } from './chat-content'

function wrap(ui: React.ReactNode) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
        nodes: [],
        onError: (e) => {
          throw e
        },
      }}
    >
      {ui}
    </LexicalComposer>
  )
}

describe('ChatContent', () => {
  test('renders a contenteditable and placeholder inside a LexicalComposer', () => {
    render(wrap(<ChatContent placeholder="Type @ to mention…" />))
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull()
    expect(screen.getByText('Type @ to mention…')).toBeDefined()
  })
})
