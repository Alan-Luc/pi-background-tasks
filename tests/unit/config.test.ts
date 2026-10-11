import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dockShortcutFooterHint,
  parseBackgroundTasksConfig,
  PI_BG_DEFAULT_DOCK_SHORTCUT,
  PI_BG_DOCK_SHORTCUT_VALUES,
} from '../../src/core/config.js';

void describe('background task configuration', () => {
  void it('defaults to the Shift+Down dock shortcut', () => {
    const config = parseBackgroundTasksConfig({});
    assert.equal(PI_BG_DEFAULT_DOCK_SHORTCUT, 'shift+down');
    assert.equal(config.dockShortcut, 'shift+down');
    assert.equal(dockShortcutFooterHint(config.dockShortcut), 'Shift↓');
  });

  void it('ignores the removed feature-selection environment variable', () => {
    assert.equal(
      parseBackgroundTasksConfig({ PI_BG_FEATURES: 'delegate,fusion' }).dockShortcut,
      'shift+down',
    );
  });

  void it('accepts only the three finite dock choices and derives their hints', () => {
    assert.deepEqual(PI_BG_DOCK_SHORTCUT_VALUES, ['shift+down', 'ctrl+alt+b', 'off']);
    assert.deepEqual(
      PI_BG_DOCK_SHORTCUT_VALUES.map((shortcut) => [
        parseBackgroundTasksConfig({ PI_BG_DOCK_SHORTCUT: shortcut }).dockShortcut,
        dockShortcutFooterHint(shortcut),
      ]),
      [
        ['shift+down', 'Shift↓'],
        ['ctrl+alt+b', 'CtrlAltB'],
        ['off', '/tasks'],
      ],
    );
  });

  void it('rejects malformed dock choices', () => {
    assert.throws(
      () => parseBackgroundTasksConfig({ PI_BG_DOCK_SHORTCUT: 'shift+up' }),
      /pi_bg_config_invalid: PI_BG_DOCK_SHORTCUT.*shift\+down,ctrl\+alt\+b,off/,
    );
  });
});
