import { truncateToWidth } from '@earendil-works/pi-tui';
import { taskDisplayName } from '../core/common.js';
const SPINNER = ['✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽'];
export class BackgroundTasksSidebar {
    tui;
    theme;
    options;
    disposed = false;
    frame = 0;
    animationInterval;
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
        const lines = [this.theme.fg('accent', `● Background jobs (${running.length})`)];
        const spinner = SPINNER[this.frame] ?? SPINNER[0];
        for (const task of visible) {
            const name = taskDisplayName(task)
                .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            lines.push(this.theme.fg('accent', `  ${spinner} ${name}`));
        }
        if (hidden > 0)
            lines.push(this.theme.fg('dim', `    … and ${hidden} more`));
        const padding = ' '.repeat(Math.max(0, width - panelWidth));
        return lines.map((line) => padding + truncateToWidth(line, panelWidth));
    }
    invalidate() { }
    refresh() {
        if (this.disposed)
            return;
        const active = !this.options.isManagerOpen() &&
            this.options.getTasks().some((task) => task.status === 'running');
        if (!active) {
            clearInterval(this.animationInterval);
            this.animationInterval = undefined;
            this.frame = 0;
        }
        else if (this.animationInterval === undefined) {
            this.animationInterval = setInterval(() => {
                this.frame = (this.frame + 1) % SPINNER.length;
                this.tui.requestRender();
            }, 150);
        }
        this.tui.requestRender();
    }
    dispose() {
        this.disposed = true;
        clearInterval(this.animationInterval);
        this.animationInterval = undefined;
    }
}
//# sourceMappingURL=background-tasks-sidebar.js.map