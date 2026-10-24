import { truncateToWidth } from '@earendil-works/pi-tui';
import { taskDisplayName } from '../core/common.js';
export class BackgroundTasksSidebar {
    tui;
    theme;
    options;
    disposed = false;
    overlay;
    constructor(tui, theme, options) {
        this.tui = tui;
        this.theme = theme;
        this.options = options;
        const component = {
            render: (width) => this.renderPanel(width),
            invalidate: () => { },
        };
        this.overlay = tui.showOverlay(component, {
            width: 36,
            anchor: 'top-right',
            margin: { top: 1, right: 1 },
            nonCapturing: true,
            visible: (width, height) => width >= 100 && height >= 20 && !options.isManagerOpen(),
        });
    }
    render(_width) {
        return [];
    }
    invalidate() { }
    refresh() {
        if (!this.disposed)
            this.tui.requestRender();
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.overlay.hide();
    }
    renderPanel(width) {
        const tasks = this.options.getTasks();
        const running = tasks.filter((task) => task.status === 'running');
        const finished = tasks.filter((task) => task.status !== 'running' && !this.options.isSeen(task.id));
        const rows = [...running, ...finished];
        const labels = {
            running: 'running', completed: 'done', failed: 'failed', killed: 'stopped',
        };
        const lines = [
            this.theme.fg('accent', 'Background jobs'),
            this.theme.fg('muted', `${running.length} running`),
        ];
        if (running.length === 0)
            lines.push(this.theme.fg('muted', 'No jobs running'));
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
//# sourceMappingURL=background-tasks-sidebar.js.map