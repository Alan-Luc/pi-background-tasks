import type { Theme } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, type Component, type TUI } from '@earendil-works/pi-tui';
import { taskDisplayName, type BgTaskSnapshot } from '../core/common.js';

export interface BackgroundTasksSidebarOptions {
  getTasks: () => readonly BgTaskSnapshot[];
  isManagerOpen: () => boolean;
}

export class BackgroundTasksSidebar implements Component {
  private disposed = false;

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
    const lines = [
      this.theme.fg('accent', '● Background jobs') +
        this.theme.fg('dim', ` · ${running.length} running`),
    ];
    for (let i = 0; i < visible.length; i++) {
      const task = visible[i];
      if (!task) continue;
      const name = taskDisplayName(task)
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const connector = i === visible.length - 1 && hidden === 0 ? '└─' : '├─';
      lines.push(
        this.theme.fg('dim', `${connector} `) +
          this.theme.fg('text', truncateToWidth(name, Math.max(1, panelWidth - 13))) +
          this.theme.fg('dim', ' · running'),
      );
    }
    lines.push(this.theme.fg('dim', hidden > 0 ? `└─ +${hidden} more · /tasks` : '   /tasks'));
    const padding = ' '.repeat(Math.max(0, width - panelWidth));
    return lines.map((line) => padding + truncateToWidth(line, panelWidth));
  }

  invalidate(): void {}

  refresh(): void {
    if (!this.disposed) this.tui.requestRender();
  }

  dispose(): void {
    this.disposed = true;
  }
}
