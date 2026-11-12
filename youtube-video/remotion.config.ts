import {Config} from '@remotion/cli/config';
import {existsSync} from 'node:fs';

// Bulut ortamında önceden kurulu Chromium'u kullan; yerel makinede Remotion kendi tarayıcısını indirir.
const LOCAL_HEADLESS_SHELL = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (existsSync(LOCAL_HEADLESS_SHELL)) {
  Config.setBrowserExecutable(LOCAL_HEADLESS_SHELL);
}
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(null);
