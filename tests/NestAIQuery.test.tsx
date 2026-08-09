import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NestAIQuery } from '../components/NestAIQuery';

// The component now calls the backend proxy via fetch (the Gemini key stays
// server-side), so we mock fetch instead of @google/genai.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'AI response', chart: null }),
    })
  );
});

describe('NestAIQuery', () => {
  const defaultProps = {
    nests: [{ id: 1, status: 'active', species: 'green', eggs: 50, location: 'beach', date: '2026-01-01' }],
    theme: 'light' as const,
  };

  it('renders correctly', () => {
    render(<NestAIQuery {...defaultProps} />);
    expect(screen.getByText('Ask AI about Nests')).toBeDefined();
    expect(screen.getByPlaceholderText(/pie chart/i)).toBeDefined();
  });

  it('handles query submission', async () => {
    render(<NestAIQuery {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/pie chart/i);
    const button = screen.getByText('Ask AI');

    fireEvent.change(textarea, { target: { value: 'How many eggs?' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('AI response')).toBeDefined();
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/nest-query'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
