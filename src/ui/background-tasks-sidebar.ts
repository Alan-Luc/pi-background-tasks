import type { Theme } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, type Component, type TUI } from '@earendil-works/pi-tui';
import { taskDisplayName, type BgTaskSnapshot } from '../core/common.js';

export interface BackgroundTasksSidebarOptions {
  getTasks: () => readonly BgTaskSnapshot[];
  isSeen: (id: string) => boolean;
  isManagerOpen: () => boolean;
}

type SidebarTui = Pick<TUI, 'showOverlay' | 'requestRender'>;

export class BackgroundTasksSidebar implements Component {
  private disposed = false;
  private readonly overlay;

  constructor(
    private readonly tui: SidebarTui,
    private readonly theme: Pick<Theme, 'fg'>,
    private readonly options: BackgroundTasksSidebarOptions,
  ) {
    const component: Component = {
      render: (width) => this.renderPanel(width),
      invalidate: () => {},
    };
    this.overlay = tui.showOverlay(component, {
      width: 36,
      anchor: 'top-right',
      margin: { top: 1, right: 1 },
      nonCapturing: true,
      visible: (width, height) => width >= 100 && height >= 20 && !options.isManagerOpen(),
    });
  }

  render(_width: number): string[] {
    return [];
  }

  invalidate(): void {}

  refresh(): void {
    if (!this.disposed) this.tui.requestRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.overlay.hide();
  }

  private renderPanel(width: number): string[] {
    const tasks = this.options.getTasks();
    const running = tasks.filter((task) => task.status === 'running');
    const finished = tasks.filter(
      (task) => task.status !== 'running' && !this.options.isSeen(task.id),
    );
    const rows = [...running, ...finished];
    const labels = {
      running: 'running', completed: 'done', failed: 'failed', killed: 'stopped',
    } as const;
    const lines = [
      this.theme.fg('accent', 'Background jobs'),
      this.theme.fg('muted', `${running.length} running`),
    ];
    if (running.length === 0) lines.push(this.theme.fg('muted', 'No jobs running'));
    for (const task of rows.slice(0, 5)) {
      const name = taskDisplayName(task)
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const status = labels[task.status];
      const available = Math.max(1, width - status.length - 1);
      const color = task.status === 'running' ? 'accent'
        : task.status === 'failed' ? 'error'
          : task.status === 'killed' ? 'warning' : 'success';
      lines.push(`${truncateToWidth(name, available)} ${this.theme.fg(color, status)}`);
    }
    lines.push(this.theme.fg('dim', rows.length > 5 ? `+${rows.length - 5} more · /tasks` : '/tasks'));
    return lines.map((line) => truncateToWidth(line, width));
  }
}
