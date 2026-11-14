import { describe, expect, it } from 'vitest';
import { reassemble } from './narratives.js';

describe('reassemble', () => {
  it('orders by line_nr and concatenates per summary_nr', () => {
    const rows = [
      { summary_nr: 1, line_nr: 6, abstract_text: 'ed.' },
      { summary_nr: 1, line_nr: 5, abstract_text: 'Employee was releas' },
      { summary_nr: 2, line_nr: 1, abstract_text: 'Fall from roof.' },
    ];
    const out = reassemble(rows);
    expect(out.get(1)).toBe('Employee was releas' + 'ed.');
    expect(out.get(2)).toBe('Fall from roof.');
  });
});
