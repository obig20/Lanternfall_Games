// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/Settings';
import { DEFAULT_BINDINGS } from '../src/input/Keybinds';
import { Hud } from '../src/ui/Hud';

let parent: HTMLElement;
let hud: Hud;

const $ = <T extends HTMLElement>(sel: string): T => parent.querySelector(sel) as T;
const press = (code: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  return e;
};

beforeEach(() => {
  parent = document.createElement('div');
  document.body.appendChild(parent);
  hud = new Hud(parent);
});

afterEach(() => {
  hud.dispose();
  parent.remove();
});

describe('Hud key rebinding', () => {
  it('lists every action with its current key', () => {
    const rows = parent.querySelectorAll('#key-list .keyrow');
    expect(rows.length).toBe(11);
    expect($('button[data-action="jump"]').textContent).toBe('Space');
    expect($('button[data-action="turnLeft"]').textContent).toBe('←');
  });

  it('waits for a key after a click, then reports the rebind', () => {
    const onRebind = vi.fn();
    hud.onRebind = onRebind;
    $('button[data-action="jump"]').click();
    expect($('button[data-action="jump"]').textContent).toBe('press a key…');
    press('KeyJ');
    expect(onRebind).toHaveBeenCalledWith('jump', 'KeyJ');
  });

  it('swallows the captured key so the game never sees it', () => {
    const gameSaw = vi.fn();
    window.addEventListener('keydown', gameSaw);
    $('button[data-action="pulse"]').click();
    const e = press('KeyX');
    window.removeEventListener('keydown', gameSaw);
    expect(e.defaultPrevented).toBe(true);
    expect(gameSaw).not.toHaveBeenCalled();
  });

  it('Escape cancels without rebinding', () => {
    const onRebind = vi.fn();
    hud.onRebind = onRebind;
    $('button[data-action="jump"]').click();
    press('Escape');
    expect(onRebind).not.toHaveBeenCalled();
    expect($('button[data-action="jump"]').textContent).toBe('Space');
  });

  it('stops listening after one key', () => {
    const onRebind = vi.fn();
    hud.onRebind = onRebind;
    $('button[data-action="jump"]').click();
    press('KeyJ');
    press('KeyK');
    expect(onRebind).toHaveBeenCalledTimes(1);
  });

  it('setBindings redraws the buttons and shows a note', () => {
    hud.setBindings({ ...DEFAULT_BINDINGS, jump: 'KeyJ' }, 'Pulse now uses Space.');
    expect($('button[data-action="jump"]').textContent).toBe('J');
    expect($('#key-note').textContent).toBe('Pulse now uses Space.');
  });

  it('hiding the pause screen cancels a pending rebind', () => {
    const onRebind = vi.fn();
    hud.onRebind = onRebind;
    $('button[data-action="jump"]').click();
    hud.showPause(false);
    press('KeyJ');
    expect(onRebind).not.toHaveBeenCalled();
  });

  it('Reset keys calls back', () => {
    const onResetKeys = vi.fn();
    hud.onResetKeys = onResetKeys;
    $('#btn-reset-keys').click();
    expect(onResetKeys).toHaveBeenCalledTimes(1);
  });
});

describe('Hud settings and screens', () => {
  it('shows and reads back the new settings', () => {
    hud.setSettings({ ...DEFAULT_SETTINGS, showHints: false, reduceFlash: true });
    expect($<HTMLInputElement>('#set-hints').checked).toBe(false);
    expect($<HTMLInputElement>('#set-flash').checked).toBe(true);
    const onSettings = vi.fn();
    hud.onSettings = onSettings;
    $<HTMLInputElement>('#set-ghost').checked = false;
    $('#set-ghost').dispatchEvent(new Event('input'));
    expect(onSettings.mock.calls[0][0]).toMatchObject({ showGhost: false, showHints: false, reduceFlash: true });
  });

  it('skips the respawn flash when reduce flashing is on', () => {
    hud.setSettings({ ...DEFAULT_SETTINGS, reduceFlash: true });
    hud.flash();
    expect($('#flash').classList.contains('on')).toBe(false);
    hud.setSettings({ ...DEFAULT_SETTINGS, reduceFlash: false });
    hud.flash();
    expect($('#flash').classList.contains('on')).toBe(true);
  });

  it('Continue button shows its label, and hides on null', () => {
    expect($('#btn-continue').classList.contains('hidden')).toBe(true);
    hud.setContinue('Continue (checkpoint 2 of 4)');
    expect($('#btn-continue').classList.contains('hidden')).toBe(false);
    expect($('#btn-continue').textContent).toBe('Continue (checkpoint 2 of 4)');
    hud.setContinue(null);
    expect($('#btn-continue').classList.contains('hidden')).toBe(true);
  });

  it('Continue and Begin call their own handlers', () => {
    const onContinue = vi.fn();
    const onStart = vi.fn();
    hud.onContinue = onContinue;
    hud.onStart = onStart;
    $('#btn-continue').click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
    $('#btn-start').click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('win screen lists unlocked achievements, or nothing', () => {
    hud.showWin(true, 61, 2, '', 'Best 1:01.0', ['Flawless', 'Quick feet']);
    expect($('#win-achievements').textContent).toBe('Unlocked: Flawless, Quick feet');
    hud.showWin(true, 61, 2, '', 'Best 1:01.0');
    expect($('#win-achievements').textContent).toBe('');
  });

  it('title and pause lines show text only when there is something to say', () => {
    hud.setAchievementProgress(0, 7);
    expect($('#title-achievements').textContent).toBe('');
    hud.setAchievementProgress(3, 7);
    expect($('#title-achievements').textContent).toBe('Achievements 3 of 7');
    hud.setLifetime('2m played');
    expect($('#lifetime').textContent).toBe('2m played');
  });
});
