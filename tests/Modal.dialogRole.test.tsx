// QA-074 (continuing): the Modal panel had no role="dialog"/aria-modal, so
// assistive tech had no way to know focus had moved into an overlay.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '../components/ui/Modal';

describe('Modal dialog semantics (QA-074)', () => {
  it('exposes role="dialog", aria-modal and an accessible name on the panel', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Example Modal">
        <p>content</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Example Modal' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
