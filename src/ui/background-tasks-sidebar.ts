import type { Theme } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, type Component, type TUI } from '@earendil-works/pi-tui';
import { taskDisplayName, type BgTaskSnapshot } from '../core/common.js';

const SPINNER = ['✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽'] as const;

export interface BackgroundTasksSidebarOptions {
  getTasks: () => readonly BgTaskSnapshot[];
  isManagerOpen: () => boolean;
}

export class BackgroundTasksSidebar implements Component {
  private disposed = false;
  private frame = 0;
  private animationInterval: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly tui: Pick<TUI, 'requestRender'>,
    private readonly theme: Pick<Theme, 'fg'>,
    private readonly options: BackgroundTasksSidebarOptions,
  ) {}

  render(width: number): string[] {
    if (this.disposed || this.options.isManagerOpen()) return [];
    const running = this.options.getTasks().filter((task) => task.status === 'running');
    if (running.length === 0) return [];
    const panelWidth = Math.min(36, width);
    const visible = running.slice(0, 5);
    const hidden = running.length - visible.length;
    const lines = [this.theme.fg('accent', `● Background jobs (${running.length})`)];
    const spinner = SPINNER[this.frame] ?? SPINNER[0];
    for (const task of visible) {
      const name = taskDisplayName(task)
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      lines.push(this.theme.fg('accent', `  ${spinner} ${name}`));
    }
    if (hidden > 0) lines.push(this.theme.fg('dim', `    … and ${hidden} more`));
    const padding = ' '.repeat(Math.max(0, width - panelWidth));
    return lines.map((line) => padding + truncateToWidth(line, panelWidth));
  }

  invalidate(): void {}

  refresh(): void {
    if (this.disposed) return;
    const active = !this.options.isManagerOpen() &&
      this.options.getTasks().some((task) => task.status === 'running');
    if (!active) {
      clearInterval(this.animationInterval);
      this.animationInterval = undefined;
      this.frame = 0;
    } else if (this.animationInterval === undefined) {
      this.animationInterval = setInterval(() => {
        this.frame = (this.frame + 1) % SPINNER.length;
        this.tui.requestRender();
      }, 150);
    }
    this.tui.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    clearInterval(this.animationInterval);
    this.animationInterval = undefined;
  }
}
