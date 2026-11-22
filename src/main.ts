import type { Preview } from './game/render/preview';
import type { GameHud, GameView } from './game/play';
import type { AttemptMode, GeneratedMission, Language, Profile, UpgradeId } from './game/core/types';
import { FOREST_MISSIONS, UPGRADES } from './game/content/fixtures';
import { openProfile, type ProfileStore } from './game/profile';
import { formatClock, resolveLanguage, setLanguage, t, type CopyKey } from './ui/copy';

const shell = document.querySelector<HTMLElement>('#shell')!;
const canvas = document.querySelector<HTMLCanvasElement>('#glade')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
const motionLabel = document.querySelector<HTMLElement>('#motion-label')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const story = document.querySelector<HTMLButtonElement>('#story')!;
const briefing = document.querySelector<HTMLDialogElement>('#briefing')!;
const briefTitle = document.querySelector<HTMLElement>('#brief-title')!;
const briefDetail = document.querySelector<HTMLElement>('#brief-detail')!;
const missionFacts = document.querySelector<HTMLElement>('#mission-facts')!;
const briefGoal = document.querySelector<HTMLElement>('#brief-goal')!;
const briefTime = document.querySelector<HTMLElement>('#brief-time')!;
const briefTunnels = document.querySelector<HTMLElement>('#brief-tunnels')!;
const missionStart = document.querySelector<HTMLButtonElement>('#mission-start')!;
const briefBack = document.querySelector<HTMLButtonElement>('#brief-back')!;
const missionTarget = document.querySelector<HTMLElement>('#mission-target')!;
const missionResult = document.querySelector<HTMLElement>('#mission-result')!;
const tutorialNext = document.querySelector<HTMLButtonElement>('#tutorial-next')!;
const gameAction = document.querySelector<HTMLButtonElement>('#game-action')!;
const gameMenu = document.querySelector<HTMLButtonElement>('#game-menu')!;
const gamePanel = document.querySelector<HTMLElement>('#game')!;
const gameClock = document.querySelector<HTMLElement>('#game-clock')!;
const gameScore = document.querySelector<HTMLElement>('#game-score')!;
const gameMode = document.querySelector<HTMLElement>('#game-mode')!;
const gameHint = document.querySelector<HTMLElement>('#game-hint')!;
const resultTip = document.querySelector<HTMLElement>('#result-tip')!;
const sceneTitle = document.querySelector<HTMLElement>('#scene-title')!;
const forestProgress = document.querySelector<HTMLElement>('#forest-progress')!;
const profileNotice = document.querySelector<HTMLElement>('#profile-notice')!;
const localSave = document.querySelector<HTMLElement>('#local-save')!;
const memoryButton = document.querySelector<HTMLButtonElement>('#profile-memory')!;
const shop = document.querySelector<HTMLButtonElement>('#shop')!;
const shopPanel = document.querySelector<HTMLDialogElement>('#shop-panel')!;
const shopBalance = document.querySelector<HTMLElement>('#shop-balance')!;
const shopIntro = document.querySelector<HTMLElement>('#shop-intro')!;
const shopFeedback = document.querySelector<HTMLElement>('#shop-feedback')!;
const shopBack = document.querySelector<HTMLButtonElement>('#shop-back')!;
const upgradeButtons = shopPanel.querySelectorAll<HTMLButtonElement>('[data-upgrade]');
const practice = document.querySelector<HTMLButtonElement>('#practice')!;
const practicePanel = document.querySelector<HTMLDialogElement>('#practice-panel')!;
const practiceBack = document.querySelector<HTMLButtonElement>('#practice-back')!;
const practiceEquipment = document.querySelector<HTMLElement>('#practice-equipment')!;
const practiceMissions = practicePanel.querySelectorAll<HTMLButtonElement>('[data-practice]');
const settings = document.querySelector<HTMLButtonElement>('#settings')!;
const settingsPanel = document.querySelector<HTMLDialogElement>('#settings-panel')!;
const settingsBack = document.querySelector<HTMLButtonElement>('#settings-back')!;
const settingSound = document.querySelector<HTMLInputElement>('#setting-sound')!;
const settingMotion = document.querySelector<HTMLInputElement>('#setting-motion')!;
const settingSensitivity = document.querySelector<HTMLSelectElement>('#setting-sensitivity')!;
const systemMotion = document.querySelector<HTMLElement>('#system-motion')!;
const languageSwitch = document.querySelector<HTMLSelectElement>('#language-switch')!;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const panelBackButtons = [[briefing, briefBack], [shopPanel, shopBack], [practicePanel, practiceBack], [settingsPanel, settingsBack]] as const;

let preview: Preview | undefined;
let game: GameView | undefined;
let pendingStart: AbortController | undefined;
let gameOpener = play;
let cancelled = false;
let campaignStep = 0;
let profile: ProfileStore | undefined;
let offeredIndex: 0 | 1 | 2 | undefined;
let offeredMode: AttemptMode = 'story';
let practicing = false;
let storyWon = false;
let previewPausedByPlayer = false;
let preferences: Profile['settings'] = { sound: true, reducedMotion: false, sensitivity: 1 };
const missionIndices = [0, 1, 2] as const;

const requestedLanguage = new URLSearchParams(location.search).get('lang');

function localizePage(language: Language) {
  setLanguage(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  document.title = t('title');
  for (const element of document.querySelectorAll<HTMLElement>('[data-copy]')) {
    setText(element, t(element.dataset.copy as CopyKey));
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-copy-label]')) {
    element.setAttribute('aria-label', t(element.dataset.copyLabel as CopyKey));
  }
  for (const [index, button] of practiceMissions.entries()) setText(button, t('missionNumber', index + 1));
  const savedSensitivity = settingSensitivity.querySelector<HTMLOptionElement>('[data-saved]');
  if (savedSensitivity) setText(savedSensitivity, t('customSensitivity', preferences.sensitivity));
  languageSwitch.value = language;
  setText(motionLabel, t(motion.dataset.paused === 'true' ? 'resumeMotion' : 'pauseMotion'));
  if (shell.dataset.state === 'ready') setText(statusMessage, t('ready'));
  refreshProfile();
}

window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});

function showFailure(message: string) {
  shell.dataset.state = 'failed';
  statusMessage.textContent = message;
  motion.hidden = true;
  play.hidden = true;
  story.hidden = true;
  shop.hidden = true;
  practice.hidden = true;
  settings.hidden = true;
  hidePanels();
  tutorialNext.hidden = true;
  gameAction.hidden = true;
  gameMenu.hidden = true;
  gamePanel.hidden = true;
  memoryButton.hidden = true;
  localSave.hidden = true;
  cancelled = true;
  profile?.close();
  preview?.dispose();
  preview = undefined;
  game = undefined;
}

function setPaused(paused: boolean) {
  preview?.setPaused(paused);
  motion.dataset.paused = String(paused);
  motionLabel.textContent = t(paused ? 'resumeMotion' : 'pauseMotion');
}

function lessMotion() {
  return preferences.reducedMotion || reducedMotion.matches;
}

function syncMotion() {
  shell.dataset.reducedMotion = String(lessMotion());
  systemMotion.hidden = !reducedMotion.matches;
  if (game) game.setReducedMotion(lessMotion());
  else setPaused(previewPausedByPlayer || lessMotion());
}

motion.onclick = () => {
  previewPausedByPlayer = motion.dataset.paused !== 'true';
  setPaused(previewPausedByPlayer);
};
reducedMotion.onchange = syncMotion;
canvas.addEventListener('webglcontextlost', () => {
  showFailure(t('graphicsLost'));
});

function setText(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}

function refreshProfile() {
  if (!profile) return;
  const { completedMissionIds, crystals, upgrades, pendingPresentationMissionId } = profile.profile;
  campaignStep = completedMissionIds.length;
  forestProgress.hidden = campaignStep === 0;
  setText(forestProgress, t('progress', campaignStep, crystals));
  setText(story, t(campaignStep === 3 ? 'viewForest' : campaignStep ? 'continueStory' : 'playStory'));
  const message = {
    durable: '',
    busy: t('busySave'),
    corrupt: t('corruptSave'),
    future: t('futureSave'),
    unavailable: t('unavailableSave'),
    memory: t('memorySave'),
  }[profile.status];
  setText(profileNotice, message);
  profileNotice.hidden = !message;
  localSave.hidden = !!message || !!game;
  const writable = profile.status === 'durable' || profile.status === 'memory';
  const unlocked = campaignStep === 3 && pendingPresentationMissionId === null;
  story.disabled = !writable && !unlocked;
  shop.hidden = practice.hidden = !unlocked || !!game;
  shop.disabled = practice.disabled = !writable;
  const canUpgrade = UPGRADES.some(({ id, cost }) => !upgrades[id] && crystals >= cost);
  const primary = unlocked && writable ? (canUpgrade ? shop : practice) : story;
  for (const button of [story, shop, practice]) button.classList.toggle('primary', button === primary);
  memoryButton.hidden = !!game || writable || profile.status === 'busy';
}

function hidePanels() {
  if (pendingStart) {
    pendingStart.abort();
    pendingStart = undefined;
    play.disabled = missionStart.disabled = false;
  }
  for (const [panel] of panelBackButtons) {
    if (panel.open) panel.close();
  }
  memoryButton.before(profileNotice);
}

function openPanel(panel: HTMLDialogElement, focus: HTMLElement) {
  hidePanels();
  // A save warning must stay visible and announced while the page behind the dialog is inert.
  panel.append(profileNotice);
  panel.showModal();
  focus.focus();
}

function elixirMessage() {
  return t(campaignStep === 3 ? 'thirdElixir' : campaignStep === 1 ? 'firstElixir' : 'secondElixir');
}

function settleDelivery() {
  const pending = profile?.profile.pendingPresentationMissionId;
  if (pending) profile?.finishPresentation(pending);
  refreshProfile();
}

function showHud(hud: GameHud) {
  storyWon = hud.storyWon;
  gamePanel.dataset.phase = hud.phase;
  gamePanel.dataset.ready = String(hud.ready);
  gamePanel.dataset.result = storyWon ? 'delivered' : '';
  if (gamePanel.dataset.paused !== String(hud.paused)) {
    gamePanel.dataset.paused = String(hud.paused);
    preview?.setPaused(hud.paused);
  }
  gameClock.dataset.ms = String(Math.round(hud.timeLeftMs));
  gameClock.hidden = hud.tutorial;
  const seconds = Math.ceil(hud.timeLeftMs / 1000);
  setText(gameClock, formatClock(seconds));
  setText(gameScore, t('lights', hud.lights, hud.total));
  gameScore.dataset.collecting = String(hud.collecting);
  gameMode.hidden = !hud.tutorial && !practicing;
  setText(gameMode, t(hud.tutorial ? 'tutorial' : 'practice'));
  missionTarget.hidden = hud.target === null;
  if (hud.target !== null) setText(missionTarget, t('target', hud.target));
  missionResult.hidden = !hud.result;
  tutorialNext.hidden = !(hud.tutorial && hud.result) || story.disabled;
  gameAction.classList.toggle('primary', tutorialNext.hidden);
  setText(tutorialNext, story.textContent || t('playStory'));
  gameMenu.hidden = storyWon || (!hud.result && !hud.paused);
  setText(missionResult, hud.result);
  setText(gameHint, storyWon ? elixirMessage() : hud.hint);
  resultTip.hidden = hud.failure === null;
  setText(resultTip, hud.failure ? t(hud.failure === 'deadline' ? 'deadlineTip' : 'steeringTip') : '');
  setText(gameAction, storyWon ? t(campaignStep < missionIndices.length ? 'nextMission' : 'backClearing') : hud.action);
  const underground = hud.phase.startsWith('tunnel');
  setText(sceneTitle, t(underground ? 'underground' : 'clearing'));
  const playfield = t(underground ? 'tunnelField' : 'forestField');
  if (canvas.getAttribute('aria-label') !== playfield) canvas.setAttribute('aria-label', playfield);
}

async function startGame(mission?: GeneratedMission, mode: AttemptMode = 'story', trainingStage = 0) {
  if (game || play.disabled) return;
  const request = new AbortController();
  pendingStart = request;
  play.disabled = true;
  missionStart.disabled = true;
  try {
    const { createGame } = await import('./game/play');
    if (!preview || request.signal.aborted) return;
    pendingStart = undefined;
    practicing = !!mission && mode === 'practice';
    gameOpener = practicing ? practice : mission ? story : play;
    game = createGame(canvas, lessMotion(), showHud, () => preview?.redraw(), {
      mission,
      mode,
      sound: preferences.sound,
      sensitivity: preferences.sensitivity,
      loadout: mission ? profile?.profile.upgrades : undefined,
      restored: practicing ? trainingStage : mission ? campaignStep : 0,
      onStoryWin(completed) {
        profile?.completeMission(completed);
        refreshProfile();
        return campaignStep;
      },
      onPracticeResult: practicing ? (completed, loadout, score) => {
        const best = profile?.recordPractice(completed, loadout, score) ?? null;
        refreshProfile();
        return best;
      } : undefined,
    });
    delete gamePanel.dataset.paused;
    gamePanel.hidden = false;
    gameAction.hidden = false;
    play.hidden = true;
    story.hidden = true;
    shop.hidden = true;
    practice.hidden = true;
    settings.hidden = true;
    localSave.hidden = true;
    memoryButton.hidden = true;
    hidePanels();
    motion.hidden = true;
    setText(gameMenu, t(practicing ? 'returnForest' : 'menu'));
    shell.dataset.playing = 'true';
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
    preview.show(game);
    game.startClock();
  } catch {
    if (!request.signal.aborted) showFailure(t('gameFailed'));
  }
}
play.onclick = () => void startGame();

function showMissionFacts(mission?: GeneratedMission) {
  missionFacts.hidden = !mission;
  if (!mission) return;
  const lights = mission.tunnels.reduce((total, tunnel) => total + tunnel.lights.length, 0);
  setText(briefGoal, t('briefLightCount', mission.definition.targetLight, lights));
  setText(briefTime, t('briefTimeCount', mission.definition.timeLimitMs / 1000));
  setText(briefTunnels, t('briefTunnelCount', mission.tunnels.length));
}

function openStoryBriefing() {
  if (!profile || story.disabled) return;
  offeredMode = 'story';
  showMissionFacts();
  if (profile.profile.pendingPresentationMissionId) {
    offeredIndex = undefined;
    setText(briefTitle, t('elixirDelivered'));
    setText(briefDetail, elixirMessage());
    setText(missionStart, t(campaignStep < 3 ? 'nextMission' : 'backClearing'));
    missionStart.hidden = false;
    openPanel(briefing, missionStart);
    return;
  }
  const index = missionIndices[campaignStep];
  offeredIndex = index;
  missionStart.hidden = index === undefined;
  if (index !== undefined) {
    setText(briefTitle, t('missionOf', index + 1, missionIndices.length));
    setText(briefDetail, t(index === 0 ? 'openingStory' : 'findTunnels'));
    showMissionFacts(FOREST_MISSIONS[index]);
    setText(missionStart, t('startMission'));
    openPanel(briefing, missionStart);
  } else {
    setText(briefTitle, t('restored'));
    setText(briefDetail, t('savedForest'));
    openPanel(briefing, briefBack);
  }
}
story.onclick = openStoryBriefing;
briefBack.onclick = () => {
  if (offeredMode === 'practice' && offeredIndex !== undefined) {
    openPractice(offeredIndex);
  } else {
    hidePanels();
    story.focus();
  }
};
missionStart.onclick = () => {
  if (profile?.profile.pendingPresentationMissionId) {
    settleDelivery();
    if (campaignStep < 3) openStoryBriefing();
    else briefBack.click();
    return;
  }
  if (offeredIndex !== undefined) {
    const mission = offeredMode === 'practice' ? profile?.practiceMission(offeredIndex) : profile?.assignMission(offeredIndex);
    refreshProfile();
    if (mission) void startGame(mission, offeredMode, offeredIndex);
  }
};

function showShop() {
  if (!profile) return;
  const { crystals, upgrades } = profile.profile;
  shopIntro.hidden = !shopFeedback.hidden;
  setText(shopBalance, t('crystals', crystals));
  UPGRADES.forEach(({ id, cost }, index) => {
    const button = upgradeButtons[index]!;
    const owned = upgrades[id] === 1;
    const shortfall = document.getElementById(button.getAttribute('aria-describedby')!)!;
    const missing = owned ? 0 : Math.max(0, cost - crystals);
    button.disabled = owned || missing > 0;
    setText(button, owned ? t('owned') : t('buy', cost));
    shortfall.hidden = missing === 0;
    setText(shortfall, missing ? t('crystalShortfall', missing) : '');
  });
}

shop.onclick = () => {
  shopFeedback.hidden = true;
  showShop();
  openPanel(shopPanel, shopPanel.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? shopBack);
};
shopBack.onclick = () => {
  hidePanels();
  shop.focus();
};
for (const button of upgradeButtons) {
  button.onclick = () => {
    const outcome = profile?.purchaseUpgrade(button.dataset.upgrade as UpgradeId);
    const messages = {
      purchased: t('equipped'),
      owned: t('alreadyOwned'),
      insufficient: t('insufficient'),
      unavailable: t('shopUnavailable'),
    };
    setText(shopFeedback, messages[outcome ?? 'unavailable']);
    shopFeedback.hidden = false;
    refreshProfile();
    showShop();
    shopFeedback.focus({ preventScroll: true });
  };
}

function openPractice(selected = 0) {
  const loadout = profile?.profile.upgrades;
  const equipment = loadout?.['exploration-radius'] ? 'explorationRadius' : loadout?.['collection-radius'] ? 'collectionRadius' : 'baseEquipment';
  setText(practiceEquipment, t('equipment', t(equipment)));
  openPanel(practicePanel, practiceMissions[selected] ?? practiceBack);
}
practice.onclick = () => openPractice();
practiceBack.onclick = () => {
  hidePanels();
  practice.focus();
};
for (const [index, button] of practiceMissions.entries()) {
  button.onclick = () => {
    if (!profile) return;
    const missionIndex = missionIndices[index];
    if (missionIndex === undefined) return;
    const mission = profile.practiceMission(missionIndex);
    if (!mission) return;
    offeredMode = 'practice';
    offeredIndex = missionIndex;
    const best = profile.practiceBest(mission, profile.profile.upgrades);
    const record = best === null ? '' : ` ${t('bestEquipment', best)}`;
    setText(briefTitle, t('practiceMission', missionIndex + 1));
    setText(briefDetail, t('practiceBrief') + record);
    showMissionFacts(mission);
    setText(missionStart, t('startPractice'));
    missionStart.hidden = false;
    openPanel(briefing, missionStart);
  };
}

function updatePreferences(changes: Partial<Profile['settings']>) {
  if (profile?.updateSettings(changes)) preferences = profile.profile.settings;
  else if (profile?.status !== 'durable') preferences = { ...preferences, ...changes };
  if (changes.language) localizePage(changes.language);
  else refreshProfile();
  if (changes.reducedMotion !== undefined) syncMotion();
}

settings.onclick = () => {
  settingSound.checked = preferences.sound;
  settingMotion.checked = preferences.reducedMotion;
  const sensitivity = String(preferences.sensitivity);
  settingSensitivity.querySelector('[data-saved]')?.remove();
  settingSensitivity.value = sensitivity;
  if (settingSensitivity.selectedIndex < 0) {
    const saved = new Option(t('customSensitivity', preferences.sensitivity), sensitivity, false, true);
    saved.dataset.saved = '';
    settingSensitivity.add(saved);
  }
  openPanel(settingsPanel, settingSound);
};
settingsBack.onclick = () => {
  hidePanels();
  settings.focus();
};
settingSound.onchange = () => updatePreferences({ sound: settingSound.checked });
settingMotion.onchange = () => updatePreferences({ reducedMotion: settingMotion.checked });
languageSwitch.onchange = () => {
  const choice = languageSwitch.value;
  if (choice !== 'fa' && choice !== 'en') return;
  updatePreferences({ language: choice });
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', choice);
    history.replaceState(history.state, '', url);
  }
};
settingSensitivity.onchange = () => {
  const sensitivity = settingSensitivity.value;
  const saved = settingSensitivity.querySelector<HTMLOptionElement>('[data-saved]');
  if (saved && saved.value !== sensitivity) saved.remove();
  updatePreferences({ sensitivity: Number(sensitivity) });
};
for (const [panel, back] of panelBackButtons) {
  panel.addEventListener('cancel', event => {
    event.preventDefault();
    back.click();
  });
}

memoryButton.onclick = () => {
  profile?.useMemory();
  profile?.updateSettings(preferences);
  refreshProfile();
  story.focus();
};
gameAction.onclick = () => {
  if (!storyWon) {
    game?.action();
    return;
  }
  settleDelivery();
  showMenu();
  if (campaignStep < missionIndices.length) openStoryBriefing();
};
function showMenu() {
  if (!preview) return;
  game = undefined;
  practicing = false;
  storyWon = false;
  gamePanel.hidden = true;
  gameAction.hidden = true;
  gameMenu.hidden = true;
  tutorialNext.hidden = true;
  delete shell.dataset.playing;
  canvas.removeAttribute('tabindex');
  canvas.setAttribute('aria-label', t('introLabel'));
  setText(sceneTitle, t('clearing'));
  play.disabled = false;
  missionStart.disabled = false;
  play.hidden = false;
  story.hidden = false;
  motion.hidden = false;
  settings.hidden = false;
  refreshProfile();
  if (campaignStep > 0) preview.showForest(campaignStep);
  else preview.showIntro();
  syncMotion();
  gameOpener.focus();
}
gameMenu.onclick = showMenu;
tutorialNext.onclick = () => {
  showMenu();
  openStoryBriefing();
};

async function start() {
  try {
    const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!context) {
      shell.dataset.state = 'unsupported';
      statusMessage.textContent = t('webgl');
      return;
    }
    const { createPreview } = await import('./game/render/preview');
    if (cancelled) return;
    preview = createPreview(canvas, context, () => showFailure(t('renderFailed')));
    profile = await openProfile();
    if (cancelled) {
      profile.close();
      return;
    }
    preferences = profile.profile.settings;
    localizePage(resolveLanguage(requestedLanguage, preferences.language));
    if (campaignStep > 0) preview.showForest(campaignStep);
    syncMotion();
    shell.dataset.state = 'ready';
    statusMessage.textContent = t('ready');
    motion.hidden = false;
    play.hidden = false;
    story.hidden = false;
    settings.hidden = false;
    if (profile.profile.pendingPresentationMissionId) openStoryBriefing();
  } catch {
    showFailure(t('loadFailed'));
  }
}

localizePage(resolveLanguage(requestedLanguage, document.documentElement.lang === 'en' ? 'en' : 'fa'));
void start();
