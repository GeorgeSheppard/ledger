import { describe, expect, it, vi } from 'vitest';
import { CommandStack, MAX_COMMANDS, type Command } from './commandStack';

/** A command that adds `by` to a counter. */
function counter() {
  const value = { n: 0 };
  const add = (by: number, scope?: string): Command => {
    value.n += by;
    return { label: `Add ${by}`, scope, undo: () => (value.n -= by), redo: () => (value.n += by) };
  };
  return { value, add };
}

describe('CommandStack', () => {
  it('undoes and redoes in order', () => {
    const { value, add } = counter();
    const stack = new CommandStack();
    stack.record(add(1));
    stack.record(add(10));
    expect(stack.getState().undoLabel).toBe('Add 10');
    expect(stack.undo()?.label).toBe('Add 10');
    expect(value.n).toBe(1);
    expect(stack.getState()).toMatchObject({ undoLabel: 'Add 1', redoLabel: 'Add 10' });
    stack.undo();
    expect(value.n).toBe(0);
    expect(stack.undo()).toBeNull();
    stack.redo();
    stack.redo();
    expect(value.n).toBe(11);
    expect(stack.redo()).toBeNull();
  });

  it('forgets the redo list when something new happens', () => {
    const { add } = counter();
    const stack = new CommandStack();
    stack.record(add(1));
    stack.undo();
    stack.record(add(2));
    expect(stack.getState().redoLabel).toBeNull();
  });

  it('says what the last undo or redo was', () => {
    const { add } = counter();
    const stack = new CommandStack();
    stack.record(add(1));
    stack.undo();
    const first = stack.getState().last;
    expect(first).toMatchObject({ kind: 'undo', label: 'Add 1' });
    stack.redo();
    expect(stack.getState().last).toMatchObject({ kind: 'redo', label: 'Add 1' });
    expect(stack.getState().last?.id).not.toBe(first?.id);
  });

  it('keeps only the latest commands', () => {
    const { add } = counter();
    const stack = new CommandStack();
    for (let i = 0; i < MAX_COMMANDS + 5; i++) stack.record(add(1));
    let undone = 0;
    while (stack.undo()) undone++;
    expect(undone).toBe(MAX_COMMANDS);
  });

  it('turns a batch into one step', () => {
    const { value, add } = counter();
    const stack = new CommandStack();
    stack.batch('Add both', () => {
      stack.record(add(1));
      stack.record(add(10));
    });
    expect(stack.getState().undoLabel).toBe('Add both');
    stack.undo();
    expect(value.n).toBe(0);
    stack.redo();
    expect(value.n).toBe(11);
    stack.undo();
    expect(stack.undo()).toBeNull();
  });

  it('records nothing for an empty batch and relabels a batch of one', () => {
    const { add } = counter();
    const stack = new CommandStack();
    stack.batch('Nothing', () => {});
    expect(stack.getState().undoLabel).toBeNull();
    stack.batch('Renamed', () => stack.record(add(1)));
    expect(stack.getState().undoLabel).toBe('Renamed');
  });

  it('drops the commands of a screen from both lists', () => {
    const { value, add } = counter();
    const stack = new CommandStack();
    stack.record(add(1));
    stack.record(add(10, 'view'));
    stack.record(add(100));
    stack.undo();
    stack.drop('view');
    expect(stack.undo()?.label).toBe('Add 1');
    expect(stack.undo()).toBeNull();
    expect(value.n).toBe(10);
  });

  it('tells subscribers about every change', () => {
    const { add } = counter();
    const stack = new CommandStack();
    const listener = vi.fn();
    const stop = stack.subscribe(listener);
    stack.record(add(1));
    stack.undo();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    stack.redo();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
