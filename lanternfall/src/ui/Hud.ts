import { SETTING_LIMITS, Settings } from '../core/Settings';

/** All on-screen text and buttons. Plain DOM (no framework) so it is easy to read and change. */
export class Hud {
  onStart: () => void = () => {};
  onResume: () => void = () => {};
  onRestart: () => void = () => {};
  onSettings: (patch: Partial<Settings>) => void = () => {};

  private readonly root = document.createElement('div');
  private readonly q = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;
  private toastTimer = 0;
  private flashTimer = 0;

  constructor(parent: HTMLElement) {
    this.root.className = 'hud-root';
    this.root.innerHTML = `
      <div class="screen" id="title-screen">
        <div class="panel">
          <h1>LANTERNFALL</h1>
          <p class="tag">The tower is dark. Your lantern is not.</p>
          <ul class="controls">
            <li><b>W A S D</b> move</li>
            <li><b>Space</b> jump</li>
            <li><b>Q</b> lantern pulse (reveals far platforms)</li>
            <li><b>Drag mouse</b> or <b>← →</b> turn camera</li>
            <li><b>Gamepad</b> left stick move &middot; A jump &middot; X pulse &middot; right stick camera</li>
            <li><b>Touch</b> on-screen stick and buttons</li>
            <li><b>R</b> back to checkpoint &nbsp; <b>Esc</b> pause &nbsp; <b>M</b> mute</li>
          </ul>
          <p class="how">Hidden platforms appear only where your lantern's light reaches.<br>Cross the ruins and reach the golden gate.</p>
          <button id="btn-start">Begin</button>
        </div>
      </div>

      <div id="hud" class="hidden">
        <div class="objective">
          <div class="label">OBJECTIVE</div>
          <div id="objective-text">Reach the golden gate</div>
          <div id="checkpoint-text" class="sub">Checkpoint: start</div>
        </div>
        <div class="pulse">
          <div class="bar"><div id="pulse-fill"></div></div>
          <div id="pulse-text">[Q] Lantern pulse</div>
        </div>
        <div id="toast" class="toast"></div>
      </div>

      <div class="screen hidden" id="pause-screen">
        <div class="panel">
          <h2>Paused</h2>
          <div class="settings">
            <label>Volume <input id="set-volume" type="range" min="${SETTING_LIMITS.volume.min}" max="${SETTING_LIMITS.volume.max}" step="0.05"></label>
            <label>Camera speed <input id="set-sens" type="range" min="${SETTING_LIMITS.sensitivity.min}" max="${SETTING_LIMITS.sensitivity.max}" step="0.1"></label>
            <label class="check"><input id="set-invert" type="checkbox"> Invert camera Y</label>
          </div>
          <button id="btn-resume">Resume</button>
        </div>
      </div>

      <div class="screen hidden" id="win-screen">
        <div class="panel">
          <h2>The gate opens</h2>
          <p class="tag">You found the light's path through the ruins.</p>
          <p id="win-stats"></p>
          <p id="win-best" class="best"></p>
          <button id="btn-restart">Play again</button>
        </div>
      </div>

      <div id="flash" class="flash"></div>
    `;
    parent.appendChild(this.root);

    this.q('#btn-start').addEventListener('click', this.start);
    this.q('#btn-resume').addEventListener('click', this.resume);
    this.q('#btn-restart').addEventListener('click', this.restart);
    for (const id of ['#set-volume', '#set-sens', '#set-invert']) this.q(id).addEventListener('input', this.settingsInput);
  }

  private settingsInput = (): void => {
    this.onSettings({
      volume: Number(this.q<HTMLInputElement>('#set-volume').value),
      sensitivity: Number(this.q<HTMLInputElement>('#set-sens').value),
      invertY: this.q<HTMLInputElement>('#set-invert').checked,
    });
  };

  /** Show the current settings in the pause panel (does not fire onSettings). */
  setSettings(s: Readonly<Settings>): void {
    this.q<HTMLInputElement>('#set-volume').value = String(s.volume);
    this.q<HTMLInputElement>('#set-sens').value = String(s.sensitivity);
    this.q<HTMLInputElement>('#set-invert').checked = s.invertY;
  }

  private start = (): void => this.onStart();
  private resume = (): void => this.onResume();
  private restart = (): void => this.onRestart();

  private show(sel: string, on: boolean): void {
    this.q(sel).classList.toggle('hidden', !on);
  }

  showTitle(on: boolean): void { this.show('#title-screen', on); }
  showHud(on: boolean): void { this.show('#hud', on); }
  showPause(on: boolean): void { this.show('#pause-screen', on); }

  /** `bestLine` is a second line such as "New best time!" or "Best 1:20.4 · fewest falls 2". */
  showWin(on: boolean, seconds = 0, falls = 0, toughest = '', bestLine = ''): void {
    if (on) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      const extra = toughest ? `  ·  Most falls: ${toughest}` : '';
      this.q('#win-stats').textContent = `Time ${m}:${s}  ·  Falls ${falls}${extra}`;
      this.q('#win-best').textContent = bestLine;
    }
    this.show('#win-screen', on);
  }

  setObjective(text: string): void {
    this.q('#objective-text').textContent = text;
  }

  setCheckpoint(label: string): void {
    this.q('#checkpoint-text').textContent = `Checkpoint: ${label}`;
  }

  setPulse(charge: number, active: boolean): void {
    this.q<HTMLElement>('#pulse-fill').style.width = `${Math.round(charge * 100)}%`;
    this.q('#pulse-text').textContent = active ? 'Pulse active' : charge >= 1 ? '[Q] Lantern pulse ready' : 'Lantern recharging…';
    this.root.classList.toggle('pulse-ready', charge >= 1);
  }

  toast(text: string, seconds = 2.2): void {
    const el = this.q<HTMLElement>('#toast');
    el.textContent = text;
    el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), seconds * 1000);
  }

  /** Brief dark flash when you fall and respawn. */
  flash(): void {
    const el = this.q<HTMLElement>('#flash');
    el.classList.add('on');
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => el.classList.remove('on'), 250);
  }

  dispose(): void {
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.flashTimer);
    this.q('#btn-start').removeEventListener('click', this.start);
    this.q('#btn-resume').removeEventListener('click', this.resume);
    this.q('#btn-restart').removeEventListener('click', this.restart);
    for (const id of ['#set-volume', '#set-sens', '#set-invert']) this.q(id).removeEventListener('input', this.settingsInput);
    this.root.remove();
  }
}
