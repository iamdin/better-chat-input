import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TagRendererContext, useTagRendererStore } from './tag-renderer-context'
import { useTagRenderer } from './use-tag-renderer'
import { TagView } from './tag-view'

// Supplies just the registry context (normally provided by <TriggerComposer>).
function TagProvider({ children }: { children: ReactNode }) {
  const registry = useTagRendererStore()
  return <TagRendererContext.Provider value={registry}>{children}</TagRendererContext.Provider>
}

function RegisterUser() {
  useTagRenderer('user', (data) => <span data-testid="custom">USER:{String(data.name)}</span>)
  return null
}

describe('TagView', () => {
  test('uses the registered renderer when present', () => {
    render(
      <TagProvider>
        <RegisterUser />
        <TagView tag={{ tagType: 'user', data: { name: 'Alice' } }} />
      </TagProvider>,
    )
    expect(screen.getByTestId('custom').textContent).toBe('USER:Alice')
  })

  test('falls back to the tag\'s own text when no renderer is registered', () => {
    render(
      <TagProvider>
        <TagView tag={{ tagType: 'command', data: { name: 'image', text: '/image' } }} />
      </TagProvider>,
    )
    expect(screen.getByText('/image')).toBeDefined()
  })

  test('falls back to name (no assumed prefix) when there is no text', () => {
    render(
      <TagProvider>
        <TagView tag={{ tagType: 'file', data: { name: 'app.tsx' } }} />
      </TagProvider>,
    )
    expect(screen.getByText('app.tsx')).toBeDefined()
  })

  test('falls back to tagType when name is absent', () => {
    render(
      <TagProvider>
        <TagView tag={{ tagType: 'mystery', data: {} }} />
      </TagProvider>,
    )
    expect(screen.getByText('mystery')).toBeDefined()
  })
})
