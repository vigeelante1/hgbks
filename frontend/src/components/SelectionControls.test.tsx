import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectionControls } from './SelectionControls'

describe('SelectionControls', () => {
  it('switches to horizon mode and shows the slider', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SelectionControls value={{ mode: 'cutoff', cutoff: '09:50', horizon_h: 24 }} onChange={onChange} maxHorizon={48} />,
    )
    expect(screen.getByDisplayValue('09:50')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Hours ahead' }))
    expect(onChange).toHaveBeenCalledWith({ mode: 'horizon' })

    rerender(
      <SelectionControls value={{ mode: 'horizon', cutoff: '09:50', horizon_h: 24 }} onChange={onChange} maxHorizon={48} />,
    )
    expect(screen.getByRole('slider', { name: 'Hours ahead' })).toBeInTheDocument()
  })
})
