import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { formatDuration, taskDisplayName } from '../core/common.js';
const SPINNER = ['✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽'];
const JOBS_MAX_WIDTH = 40;
const TASKS_MIN_WIDTH = 64;
const COLUMN_GAP = 2;
export const TASKS_WIDGET_HOST_EVENT = 'pi-background-tasks:tasks-widget-host:v1';
function leftAligned(value, width, contentWidth, inset = 0) {
    const leftInset = Math.min(inset, Math.max(0, contentWidth - 1));
    return ' '.repeat(width - contentWidth + leftInset) + truncateToWidth(value, contentWidth - leftInset);
}
export class BackgroundTasksSidebar {
    tui;
    theme;
    options;
    disposed = false;
    frame = 0;
    animationInterval;
    tasksWidget;
    constructor(tui, theme, options) {
        this.tui = tui;
        this.theme = theme;
        this.options = options;
    }
    render(width) {
        if (this.disposed || width < 1)
            return [];
        const running = this.options.isManagerOpen() ? [] : this.options.getTasks()
            .filter((task) => task.status === 'running')
            .sort((a, b) => a.startTime - b.startTime);
        if (running.length === 0)
            return this.tasksWidget?.render(width) ?? [];
        const now = Date.now();
        const panel = {
            title: `● Background jobs (${running.length})`,
            rows: running.slice(0, 5).map((task, index) => ({
                numberLabel: `#${index + 1} `,
                name: taskDisplayName(task)
                    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim(),
                duration: `(${formatDuration(Math.max(0, now - task.startTime))})`,
            })),
            hiddenCount: Math.max(0, running.length - 5),
        };
        const jobWidth = Math.min(width, JOBS_MAX_WIDTH, Math.max(visibleWidth(panel.title), ...panel.rows.map((row) => visibleWidth(row.numberLabel + row.name) + visibleWidth(row.duration) + 5)));
        if (!this.tasksWidget)
            return this.renderJobs(panel, width, jobWidth);
        const tasksWidth = width - jobWidth - COLUMN_GAP;
        if (tasksWidth < TASKS_MIN_WIDTH) {
            return [...this.tasksWidget.render(width), ...this.renderJobs(panel, width, jobWidth)];
        }
        const tasks = this.tasksWidget.render(tasksWidth);
        if (tasks.length === 0)
            return this.renderJobs(panel, width, jobWidth);
        const jobs = this.renderJobs(panel, jobWidth, jobWidth);
        return Array.from({ length: Math.max(tasks.length, jobs.length) }, (_, index) => {
            const left = truncateToWidth(tasks[index] ?? '', tasksWidth);
            return left + ' '.repeat(tasksWidth - visibleWidth(left) + COLUMN_GAP) +
                (jobs[index] ?? ' '.repeat(jobWidth));
        });
    }
    renderJobs(panel, width, contentWidth) {
        const lines = [leftAligned(this.theme.fg('accent', panel.title), width, contentWidth)];
        const spinner = SPINNER[this.frame] ?? SPINNER[0];
        const rowWidth = Math.max(1, contentWidth - Math.min(2, contentWidth - 1));
        for (const row of panel.rows) {
            const durationWidth = visibleWidth(row.duration);
            const content = rowWidth <= durationWidth + 3
                ? this.theme.fg('dim', truncateToWidth(row.duration, rowWidth))
                : this.theme.fg('accent', `${spinner} `) +
                    truncateToWidth(this.theme.fg('dim', row.numberLabel) + this.theme.fg('accent', row.name), rowWidth - durationWidth - 3) +
                    this.theme.fg('dim', ` ${row.duration}`);
            lines.push(leftAligned(content, width, contentWidth, 2));
        }
        if (panel.hiddenCount > 0) {
            lines.push(leftAligned(this.theme.fg('dim', `… and ${panel.hiddenCount} more`), width, contentWidth, 2));
        }
        return lines;
    }
    setTasksWidget(create) {
        if (this.disposed)
            return false;
        const next = create?.();
        const previous = this.tasksWidget;
        this.tasksWidget = next;
        if (previous !== next)
            previous?.dispose?.();
        this.tui.requestRender();
        return true;
    }
    invalidate() {
        this.tasksWidget?.invalidate();
    }
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
        if (this.disposed)
            return;
        this.disposed = true;
        clearInterval(this.animationInterval);
        this.animationInterval = undefined;
        const tasks = this.tasksWidget;
        this.tasksWidget = undefined;
        tasks?.dispose?.();
    }
}
//# sourceMappingURL=background-tasks-sidebar.js.map