import { replaceFileDurable } from './durable-fs.js';
function signalError(signal) {
    const reason = signal.reason;
    return reason instanceof Error
        ? reason
        : new Error(`Background task operation cancelled${reason === undefined ? '' : `: ${String(reason)}`}`);
}
function throwIfAborted(signal) {
    if (signal?.aborted === true)
        throw signalError(signal);
}
export async function writeJsonAtomic(path, value, signal) {
    throwIfAborted(signal);
    await replaceFileDurable(path, `${JSON.stringify(value, null, 2)}\n`, signal === undefined ? {} : { signal });
}
export async function closeAndFsyncOutputStream(stream) {
    if (!stream)
        return;
    await new Promise((resolvePromise, reject) => {
        let settled = false;
        const finish = () => {
            if (settled)
                return;
            settled = true;
            stream.off('error', fail);
            stream.off('close', finish);
            stream.off('finish', finish);
            resolvePromise();
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            stream.off('close', finish);
            reject(error);
        };
        stream.once('close', finish);
        stream.once('finish', finish);
        stream.once('error', fail);
        stream.end();
    });
}
//# sourceMappingURL=task-durable.js.map