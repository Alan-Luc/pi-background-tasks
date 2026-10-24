import { truncateToWidth } from '@earendil-works/pi-tui';
import { taskDisplayName } from '../core/common.js';
export class BackgroundTasksSidebar {
    tui;
    theme;
    options;
    disposed = false;
    constructor(tui, theme, options) {
        this.tui = tui;
        this.theme = theme;
        this.options = options;
    }
    render(width) {
        if (this.disposed || this.options.isManagerOpen())
            return [];
        const running = this.options.getTasks().filter((task) => task.status === 'running');
        if (running.length === 0)
            return [];
        const panelWidth = Math.min(36, width);
        const visible = running.slice(0, 5);
        const hidden = running.length - visible.length;
        const lines = [
            this.theme.fg('accent', '● Background jobs') +
                this.theme.fg('dim', ` · ${running.length} running`),
        ];
        for (let i = 0; i < visible.length; i++) {
            const task = visible[i];
            if (!task)
                continue;
            const name = taskDisplayName(task)
                .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const connector = i === visible.length - 1 && hidden === 0 ? '└─' : '├─';
            lines.push(this.theme.fg('dim', `${connector} `) +
                this.theme.fg('text', truncateToWidth(name, Math.max(1, panelWidth - 13))) +
                this.theme.fg('dim', ' · running'));
        }
        lines.push(this.theme.fg('dim', hidden > 0 ? `└─ +${hidden} more · /tasks` : '   /tasks'));
        const padding = ' '.repeat(Math.max(0, width - panelWidth));
        return lines.map((line) => padding + truncateToWidth(line, panelWidth));
    }
    invalidate() { }
    refresh() {
        if (!this.disposed)
            this.tui.requestRender();
    }
    dispose() {
        this.disposed = true;
    }
}
//# sourceMappingURL=background-tasks-sidebar.js.map