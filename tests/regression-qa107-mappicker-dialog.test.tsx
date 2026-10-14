// QA-107: the "Place on the map" picker had no role="dialog", so a screen
// reader gave no indication it was a dialog, and Escape did nothing - the
// overlay stayed open and blocked the form underneath until Cancel/X was
// pressed. Its subtitle also always said "Tap where the nest is", even when
// picking the start of an emergence track. Mirrors the Escape-to-close and
// role="dialog" pattern already fixed for other modals (QA-025).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapPicker from '../components/MapPicker';

describe('MapPicker dialog semantics and wording (QA-107)', () => {
  it('is a labelled dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(<MapPicker open={true} onClose={onClose} onPick={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /place on the map/i });
    expect(dialog).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not react to Escape while closed', () => {
    const onClose = vi.fn();
    render(<MapPicker open={false} onClose={onClose} onPick={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('defaults to nest wording', () => {
    render(<MapPicker open={true} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByText(/tap where the nest is/i)).toBeDefined();
  });

  it('uses track wording when subject is "track" (an emergence)', () => {
    render(<MapPicker open={true} onClose={vi.fn()} onPick={vi.fn()} subject="track" />);
    expect(screen.getByText(/tap where the track starts/i)).toBeDefined();
    expect(screen.queryByText(/tap where the nest is/i)).toBeNull();
  });
});
