'use strict';

/**
 * Windows 自定义标题栏
 * macOS 由系统绘制, 不显示此栏
 */

import { $ } from '../core/dom.js';
import { windowMin, windowMax, forceQuit } from '../core/api.js';
import { state } from '../core/state.js';
import { showCloseModal } from '../components/modal.js';
import { mountToggleButton } from '../core/theme.js';

export function setupTitlebar() {
  $('tb-min')?.addEventListener('click', () => windowMin());
  $('tb-max')?.addEventListener('click', () => windowMax());
  $('tb-close')?.addEventListener('click', () => {
    if (state.tasks.size > 0) showCloseModal(state.tasks.size);
    else forceQuit();
  });

  // 主题切换按钮
  const themeHost = $('theme-toggle-host');
  if (themeHost) mountToggleButton(themeHost);
}
