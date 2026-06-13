import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  test('renders a contenteditable and placeholder', () => {
    render(<ChatInput onSubmit={() => {}} placeholder="Type @ to mention…" />)
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull()
    expect(screen.getByText('Type @ to mention…')).toBeDefined()
  })

  test('accepts tag renderers without throwing', () => {
    render(
      <ChatInput
        onSubmit={() => {}}
        placeholder="x"
        tagRenderers={[{ tagType: 'user', render: (d) => <span>@{String(d.name)}</span> }]}
      />,
    )
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull()
  })
})
