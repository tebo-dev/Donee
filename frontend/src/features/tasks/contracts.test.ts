import { describe, expect, it } from 'vitest';
import { taskFormSchema, tagPatch, safeUrl } from './contracts';

describe('task contracts', () => {
  const value = {
    title: '  A small thing  ',
    description: ' ',
    priority: 2,
    due_at: '2026-10-19',
    status: 'to do',
    tagIds: [],
  };
  it('trims titles and descriptions, requires a real date, bounds database integers', () => {
    expect(taskFormSchema.parse(value).title).toBe('A small thing');
    expect(taskFormSchema.parse(value).description).toBe('');
    expect(
      taskFormSchema.safeParse({ ...value, due_at: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      taskFormSchema.safeParse({ ...value, priority: 32768 }).success,
    ).toBe(false);
    expect(taskFormSchema.safeParse({ ...value, title: 'x' }).success).toBe(
      false,
    );
  });
  it('only assigns and removes changed tags', () => {
    expect(tagPatch(['a', 'b'], ['b', 'c'])).toEqual({
      add_tag_ids: ['c'],
      remove_tag_ids: ['a'],
    });
  });
  it('never renders executable attachment URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,hi')).toBeUndefined();
    expect(safeUrl('https://example.com')).toBe('https://example.com/');
  });
});
