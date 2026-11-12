import { describe, expect, it } from 'vitest';
import { addLeaveGuard, needsLeaveGuard } from '../src/ui/leaveGuard';
import { Selection } from '../src/ui/timeline';

describe('UX5 leave guard', () => {
  it('is active only while saving or while unsaved choices exist', () => {
    expect(needsLeaveGuard({ saving: false, choicesMade: false, saved: false })).toBe(false); // idle, default selection
    expect(needsLeaveGuard({ saving: true, choicesMade: false, saved: false })).toBe(true); // save running
    expect(needsLeaveGuard({ saving: false, choicesMade: true, saved: false })).toBe(true); // choices made
    expect(needsLeaveGuard({ saving: false, choicesMade: true, saved: true })).toBe(false); // saved: nothing to lose
    expect(needsLeaveGuard({ saving: true, choicesMade: true, saved: true })).toBe(true); // a new save over a finished one
  });

  it('prevents unload only when active at that moment, and the remover detaches it', () => {
    const listeners = new Map<string, EventListener>();
    const target = {
      addEventListener: (t: string, l: EventListener) => listeners.set(t, l),
      removeEventListener: (t: string, l: EventListener) => { if (listeners.get(t) === l) listeners.delete(t); },
    } as unknown as Window;
    let active = false;
    const remove = addLeaveGuard(target, () => active);
    const fire = () => {
      const e = { defaultPrevented: false, returnValue: undefined as unknown, preventDefault() { this.defaultPrevented = true; } };
      listeners.get('beforeunload')!(e as unknown as Event);
      return e;
    };
    expect(fire().defaultPrevented).toBe(false);
    active = true;
    const e = fire();
    expect(e.defaultPrevented).toBe(true);
    expect(e.returnValue).toBe('');
    remove();
    expect(listeners.has('beforeunload')).toBe(false);
  });

  it('Selection.changed() reports any untick, and is false again once everything is selected', () => {
    const sel = new Selection(5);
    expect(sel.changed()).toBe(false);
    sel.set([2], false);
    expect(sel.changed()).toBe(true);
    sel.set([0, 1, 2, 3, 4], true);
    expect(sel.changed()).toBe(false);
    expect(new Selection(0).changed()).toBe(false);
  });
});
