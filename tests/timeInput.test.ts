import { describe, it, expect, vi } from 'vitest';
import {
  applyTimeDigit,
  completeTimeInput,
  formatTimeDigits,
  timeInputProps,
} from '../lib/utils';

/** Drives the field the way a browser does: apply the edit, then hand it over. */
const type = (start: string, keys: string) => {
  let value = start;
  for (const key of keys) {
    const props = timeInputProps(value, (next) => { value = next; });
    // The browser inserts the character at the caret (end of field) first.
    props.onChange({ target: { value: value + key } });
  }
  return value;
};

describe('formatTimeDigits', () => {
  it('adds the colon once minutes begin', () => {
    expect(formatTimeDigits('')).toBe('');
    expect(formatTimeDigits('1')).toBe('1');
    expect(formatTimeDigits('10')).toBe('10');
    expect(formatTimeDigits('103')).toBe('10:3');
    expect(formatTimeDigits('1030')).toBe('10:30');
  });
});

describe('applyTimeDigit', () => {
  it('fills an empty field left to right', () => {
    expect(type('', '1030')).toBe('10:30');
  });

  it('shifts a digit that cannot be a tens place into the units place', () => {
    // Typing "9" for the hour means 09, not a dead keystroke.
    expect(type('', '9')).toBe('09');
    expect(type('', '930')).toBe('09:30');
    // Same for minutes: 7 can only be 07.
    expect(type('', '107')).toBe('10:07');
  });

  it('rejects hours that could only ever be invalid', () => {
    expect(applyTimeDigit('2', '5')).toBe('2');
    expect(applyTimeDigit('2', '3')).toBe('23');
  });

  it('ignores non-digits', () => {
    expect(applyTimeDigit('10', 'a')).toBe('10');
  });
});

describe('typing into a field that already has a value', () => {
  // The reported bug: the old mask appended the digit, sliced back to four, and
  // silently dropped it — so typing into a populated field did nothing, or
  // scrambled the value when typed mid-field.
  it('starts a fresh time instead of dropping the keystroke', () => {
    expect(type('10:30', '9')).toBe('09');
    expect(type('10:30', '0945')).toBe('09:45');
  });

  it('supports correcting the tail after a backspace', () => {
    // "10:30" -> backspace -> "10:3" -> type 5 -> "10:35"
    let value = '10:3';
    const props = timeInputProps(value, (next) => { value = next; });
    props.onChange({ target: { value: '10:35' } });
    expect(value).toBe('10:35');
  });

  it('replaces the value when the field is selected first', () => {
    let value = '10:30';
    const props = timeInputProps(value, (next) => { value = next; });
    // Select-all then type "7": the browser hands back just that character.
    props.onChange({ target: { value: '7' } });
    expect(value).toBe('7');
  });

  it('handles deletion', () => {
    let value = '10:30';
    const props = timeInputProps(value, (next) => { value = next; });
    props.onChange({ target: { value: '10:3' } });
    expect(value).toBe('10:3');
  });
});

describe('completeTimeInput', () => {
  it('pads a part-typed time', () => {
    expect(completeTimeInput('')).toBe('');
    expect(completeTimeInput('9')).toBe('09:00');
    expect(completeTimeInput('10')).toBe('10:00');
    expect(completeTimeInput('10:3')).toBe('10:30');
    expect(completeTimeInput('10:30')).toBe('10:30');
  });

  it('clamps out-of-range values that bypassed the mask', () => {
    expect(completeTimeInput('99:99')).toBe('23:59');
  });
});

describe('timeInputProps blur', () => {
  it('completes the value and still calls the caller-supplied onBlur', () => {
    let value = '9';
    const onBlur = vi.fn();
    const props = timeInputProps(value, (next) => { value = next; }, { onBlur });
    props.onBlur();
    expect(value).toBe('09:00');
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('leaves an already-complete value untouched', () => {
    const onChange = vi.fn();
    timeInputProps('10:30', onChange).onBlur();
    expect(onChange).not.toHaveBeenCalled();
  });
});
