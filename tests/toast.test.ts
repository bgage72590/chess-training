import { describe, expect, it } from 'vitest';
import { __toastsForTests, dismiss, toast } from '../src/lib/toast';

describe('notices', () => {
  it('a notice that waits to be closed is not pushed out by passing ones', () => {
    toast({ title: 'Update ready', closable: true }, 0);
    for (let i = 1; i <= 6; i++) toast({ title: `XP ${i}` });
    expect(__toastsForTests().map((t) => t.title)).toEqual(['Update ready', 'XP 4', 'XP 5', 'XP 6']);
    dismiss(__toastsForTests()[0].id);
    expect(__toastsForTests().map((t) => t.title)).toEqual(['XP 4', 'XP 5', 'XP 6']);
  });
});
