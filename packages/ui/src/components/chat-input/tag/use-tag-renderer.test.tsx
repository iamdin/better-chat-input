import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { TagProvider } from './TagProvider'
import { useTagRenderer, useTagRendererRegistry } from './use-tag-renderer'

function RegisterUser() {
  useTagRenderer('user', (data) => <span data-testid="user-tag">@{String(data.name)}</span>)
  return null
}

function Probe({ type }: { type: string }) {
  const render = useTagRendererRegistry(type)
  return <>{render ? render({ name: 'Alice' }) : <span data-testid="no-renderer">none</span>}</>
}

describe('tag renderer registry', () => {
  test('a registered renderer is retrievable by tagType', () => {
    render(
      <TagProvider>
        <RegisterUser />
        <Probe type="user" />
      </TagProvider>,
    )
    expect(screen.getByTestId('user-tag').textContent).toBe('@Alice')
  })

  test('an unregistered tagType returns undefined', () => {
    render(
      <TagProvider>
        <Probe type="file" />
      </TagProvider>,
    )
    expect(screen.getByTestId('no-renderer')).toBeDefined()
  })

  test('unmounting the registrar unregisters its renderer', () => {
    function Harness({ showRegistrar }: { showRegistrar: boolean }) {
      return (
        <TagProvider>
          {showRegistrar ? <RegisterUser /> : null}
          <Probe type="user" />
        </TagProvider>
      )
    }
    const { rerender } = render(<Harness showRegistrar />)
    expect(screen.getByTestId('user-tag').textContent).toBe('@Alice')
    rerender(<Harness showRegistrar={false} />)
    expect(screen.queryByTestId('user-tag')).toBeNull()
    expect(screen.getByTestId('no-renderer')).toBeDefined()
  })
})
