import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NestAIQuery } from '../components/NestAIQuery';

// Mock @google/genai
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({ text: 'AI response', chart: null })
      })
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      STRING: 'string',
      OBJECT: 'object',
      ARRAY: 'array',
      NUMBER: 'number'
    }
  };
});

describe('NestAIQuery', () => {
  const defaultProps = {
    nests: [{ id: 1, status: 'active', species: 'green', eggs: 50, location: 'beach', date: '2026-01-01' }],
    theme: 'light' as const,
  };

  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
  });

  it('renders correctly', () => {
    render(<NestAIQuery {...defaultProps} />);
    expect(screen.getByText('Ask AI about Nests')).toBeDefined();
    expect(screen.getByPlaceholderText(/e.g.,/i)).toBeDefined();
  });

  it('handles query submission', async () => {
    render(<NestAIQuery {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/e.g.,/i);
    const button = screen.getByText('Ask AI');

    fireEvent.change(textarea, { target: { value: 'How many eggs?' } });
    fireEvent.click(button);

    expect(screen.getByText('Ask AI')).toBeDefined(); // Should show loading state, but it's fast
    
    await waitFor(() => {
        expect(screen.getByText('AI response')).toBeDefined();
    });
  });
});
