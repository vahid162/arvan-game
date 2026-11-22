import type { Preview } from './game/render/preview';
import type { GameHud, GameView } from './game/play';
import type { AttemptMode, GeneratedMission, UpgradeId } from './game/core/types';
import { FOREST_MISSIONS, UPGRADES } from './game/content/fixtures';
import { openProfile, type ProfileStore } from './game/profile';

const shell = document.querySelector<HTMLElement>('#shell')!;
const canvas = document.querySelector<HTMLCanvasElement>('#glade')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
const motionLabel = document.querySelector<HTMLElement>('#motion-label')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const story = document.querySelector<HTMLButtonElement>('#story')!;
const briefing = document.querySelector<HTMLElement>('#briefing')!;
const briefTitle = document.querySelector<HTMLElement>('#brief-title')!;
const briefDetail = document.querySelector<HTMLElement>('#brief-detail')!;
const missionStart = document.querySelector<HTMLButtonElement>('#mission-start')!;
const briefBack = document.querySelector<HTMLButtonElement>('#brief-back')!;
const missionTarget = document.querySelector<HTMLElement>('#mission-target')!;
const missionResult = document.querySelector<HTMLElement>('#mission-result')!;
const elixir = document.querySelector<HTMLElement>('#elixir')!;
const gameAction = document.querySelector<HTMLButtonElement>('#game-action')!;
const gameMenu = document.querySelector<HTMLButtonElement>('#game-menu')!;
const gamePanel = document.querySelector<HTMLElement>('#game')!;
const gameClock = document.querySelector<HTMLElement>('#game-clock')!;
const gameScore = document.querySelector<HTMLElement>('#game-score')!;
const practiceLabel = document.querySelector<HTMLElement>('#practice-label')!;
const gameHint = document.querySelector<HTMLElement>('#game-hint')!;
const sceneTitle = document.querySelector<HTMLElement>('#scene-title')!;
const forestProgress = document.querySelector<HTMLElement>('#forest-progress')!;
const profileNotice = document.querySelector<HTMLElement>('#profile-notice')!;
const memoryButton = document.querySelector<HTMLButtonElement>('#profile-memory')!;
const shop = document.querySelector<HTMLButtonElement>('#shop')!;
const shopPanel = document.querySelector<HTMLElement>('#shop-panel')!;
const shopBalance = document.querySelector<HTMLElement>('#shop-balance')!;
const shopFeedback = document.querySelector<HTMLElement>('#shop-feedback')!;
const shopBack = document.querySelector<HTMLButtonElement>('#shop-back')!;
const upgradeButtons = shopPanel.querySelectorAll<HTMLButtonElement>('[data-upgrade]');
const practice = document.querySelector<HTMLButtonElement>('#practice')!;
const practicePanel = document.querySelector<HTMLElement>('#practice-panel')!;
const practiceBack = document.querySelector<HTMLButtonElement>('#practice-back')!;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let preview: Preview | undefined;
let game: GameView | undefined;
let cancelled = false;
let campaignStep = 0;
let profile: ProfileStore | undefined;
let offeredIndex: 0 | 1 | 2 | undefined;
let offeredMode: AttemptMode = 'story';
let practicing = false;
let storyWon = false;
const missionIndices = [0, 1, 2] as const;

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
  hidePanels();
  gameAction.hidden = true;
  gameMenu.hidden = true;
  gamePanel.hidden = true;
  memoryButton.hidden = true;
  cancelled = true;
  profile?.close();
  preview?.dispose();
  preview = undefined;
  game = undefined;
}

function setPaused(paused: boolean) {
  preview?.setPaused(paused);
  motion.dataset.paused = String(paused);
  motionLabel.textContent = paused ? 'Resume motion' : 'Pause motion';
}

motion.onclick = () => setPaused(motion.dataset.paused !== 'true');
reducedMotion.onchange = () => {
  if (game) game.setReducedMotion(reducedMotion.matches);
  else if (reducedMotion.matches) setPaused(true);
};
canvas.addEventListener('webglcontextlost', () => {
  showFailure('The graphics connection was interrupted. Reload to return to the clearing.');
});

function setText(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}

function refreshProfile() {
  if (!profile) return;
  campaignStep = profile.profile.completedMissionIds.length;
  forestProgress.hidden = campaignStep === 0;
  setText(forestProgress, `Forest restored: ${campaignStep} / 3 · ${profile.profile.crystals} crystals`);
  setText(story, campaignStep === 3 ? 'View forest' : campaignStep ? 'Continue story' : 'Play story');
  const message = {
    durable: '',
    busy: 'Another tab has the forest open. Story progress is read-only here.',
    corrupt: 'The forest save could not be read. The saved data is still here.',
    future: 'This save belongs to a newer version of Light Hunt. The saved data is still here.',
    unavailable: 'This browser cannot access safe local saving.',
    memory: 'Could not save progress. New progress will only be available in this tab.',
  }[profile.status];
  setText(profileNotice, message);
  profileNotice.hidden = !message;
  const writable = profile.status === 'durable' || profile.status === 'memory';
  const unlocked = campaignStep === 3 && profile.profile.pendingPresentationMissionId === null;
  story.disabled = !writable && !unlocked;
  shop.hidden = practice.hidden = !unlocked || !!game;
  shop.disabled = practice.disabled = !writable;
  memoryButton.hidden = writable || profile.status === 'busy';
}

function hidePanels() {
  briefing.hidden = shopPanel.hidden = practicePanel.hidden = true;
}

function elixirMessage() {
  if (campaignStep === 3) return 'The third elixir steadied the guardian’s torch. The restored forest earned you 12 crystals.';
  return campaignStep === 1
    ? 'The guardian took the first elixir. Light now reaches the near bank.'
    : 'The guardian took the second elixir. Light spreads deeper into the forest.';
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
  if (gamePanel.dataset.paused !== String(hud.paused)) {
    gamePanel.dataset.paused = String(hud.paused);
    preview?.setPaused(hud.paused);
  }
  gameClock.dataset.ms = String(Math.round(hud.timeLeftMs));
  const seconds = Math.ceil(hud.timeLeftMs / 1000);
  setText(gameClock, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  setText(gameScore, `${hud.lights} / ${hud.total} lights`);
  gameScore.dataset.collecting = String(hud.collecting);
  missionTarget.hidden = hud.target === null;
  if (hud.target !== null) setText(missionTarget, `Target ${hud.target}`);
  missionResult.hidden = !hud.result;
  elixir.hidden = !hud.carryingElixir;
  gameMenu.hidden = !hud.result && !(practicing && hud.paused);
  setText(missionResult, hud.result);
  setText(gameHint, storyWon ? elixirMessage() : hud.hint);
  setText(gameAction, storyWon ? (campaignStep < missionIndices.length ? 'Next mission' : 'Back to clearing') : hud.action);
  const underground = hud.phase.startsWith('tunnel');
  setText(sceneTitle, underground ? 'Under the forest' : 'Forest clearing');
  const playfield = underground ? 'Tunnel playfield' : 'Forest playfield';
  if (canvas.getAttribute('aria-label') !== playfield) canvas.setAttribute('aria-label', playfield);
}

async function startGame(mission?: GeneratedMission, mode: AttemptMode = 'story', trainingStage = 0) {
  if (game || play.disabled) return;
  play.disabled = true;
  missionStart.disabled = true;
  practicing = !!mission && mode === 'practice';
  try {
    const { createGame } = await import('./game/play');
    if (!preview) return;
    game = createGame(canvas, reducedMotion.matches, showHud, () => preview?.redraw(), {
      mission,
      mode,
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
    practiceLabel.hidden = !practicing;
    gamePanel.hidden = false;
    gameAction.hidden = false;
    play.hidden = true;
    story.hidden = true;
    shop.hidden = true;
    practice.hidden = true;
    hidePanels();
    motion.hidden = true;
    setText(gameMenu, practicing ? 'Return to forest' : 'Back to menu');
    shell.dataset.playing = 'true';
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
    preview.show(game);
    game.startClock();
  } catch {
    showFailure('The clearing could not start. Reload the preview to try again.');
  }
}
play.onclick = () => void startGame();
function openStoryBriefing() {
  if (!profile || story.disabled) return;
  hidePanels();
  offeredMode = 'story';
  briefing.hidden = false;
  if (profile.profile.pendingPresentationMissionId) {
    offeredIndex = undefined;
    setText(briefTitle, 'Elixir delivered');
    setText(briefDetail, elixirMessage());
    setText(missionStart, campaignStep < 3 ? 'Next mission' : 'Back to clearing');
    missionStart.hidden = false;
    missionStart.focus();
    return;
  }
  const index = missionIndices[campaignStep];
  offeredIndex = index;
  missionStart.hidden = index === undefined;
  if (index !== undefined) {
    setText(briefTitle, `Mission ${index + 1} of 3`);
    setText(briefDetail, `Collect ${FOREST_MISSIONS[index].definition.targetLight} of 36 lights across three tunnels. You have 90 seconds of active time.`);
    setText(missionStart, 'Start mission');
    missionStart.focus();
  } else {
    setText(briefTitle, 'Forest restored');
    setText(briefDetail, 'The guardian’s torch is steady. Your crystals stay with your local forest.');
    briefBack.focus();
  }
}
story.onclick = openStoryBriefing;
briefBack.onclick = () => {
  briefing.hidden = true;
  if (offeredMode === 'practice') practice.click();
  else story.focus();
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
  setText(shopBalance, `${crystals} crystals`);
  UPGRADES.forEach(({ id, cost }, index) => {
    const button = upgradeButtons[index]!;
    const owned = upgrades[id] === 1;
    button.disabled = owned || crystals < cost;
    setText(button, owned ? 'Owned' : `Buy for ${cost} crystals`);
  });
}

shop.onclick = () => {
  hidePanels();
  shopFeedback.hidden = true;
  shopPanel.hidden = false;
  showShop();
  shopBack.focus();
};
shopBack.onclick = () => {
  hidePanels();
  shop.focus();
};
for (const button of upgradeButtons) {
  button.onclick = () => {
    const outcome = profile?.purchaseUpgrade(button.dataset.upgrade as UpgradeId);
    const messages = {
      purchased: 'Upgrade equipped for your next practice run.',
      owned: 'You already own this upgrade.',
      insufficient: 'You need more crystals.',
      unavailable: 'The shop is unavailable in this tab.',
    };
    setText(shopFeedback, messages[outcome ?? 'unavailable']);
    shopFeedback.hidden = false;
    refreshProfile();
    showShop();
    shopBack.focus();
  };
}

practice.onclick = () => {
  hidePanels();
  practicePanel.hidden = false;
  practicePanel.querySelector('button')?.focus();
};
practiceBack.onclick = () => {
  hidePanels();
  practice.focus();
};
for (const button of practicePanel.querySelectorAll<HTMLButtonElement>('[data-practice]')) {
  button.onclick = () => {
    if (!profile) return;
    const index = missionIndices[Number(button.dataset.practice)];
    if (index === undefined) return;
    const mission = profile.practiceMission(index);
    if (!mission) return;
    offeredMode = 'practice';
    offeredIndex = index;
    const best = profile.practiceBest(mission, profile.profile.upgrades);
    const record = best === null ? '' : ` Best with this equipment: ${best} lights.`;
    setText(briefTitle, `Practice mission ${index + 1}`);
    setText(briefDetail, `Collect ${mission.definition.targetLight} of 36 lights in 90 active seconds. Practice pays no story rewards.${record}`);
    setText(missionStart, 'Start practice');
    missionStart.hidden = false;
    hidePanels();
    briefing.hidden = false;
    missionStart.focus();
  };
}
memoryButton.onclick = () => {
  profile?.useMemory();
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
  const wasPracticing = practicing;
  game = undefined;
  practicing = false;
  storyWon = false;
  gamePanel.hidden = true;
  gameAction.hidden = true;
  gameMenu.hidden = true;
  delete shell.dataset.playing;
  canvas.removeAttribute('tabindex');
  canvas.setAttribute('aria-label', 'A golden firefly hovering among reeds in a blue-green clearing');
  setText(sceneTitle, 'Forest clearing');
  play.disabled = false;
  missionStart.disabled = false;
  play.hidden = false;
  story.hidden = false;
  motion.hidden = false;
  refreshProfile();
  if (campaignStep > 0) preview.showForest(campaignStep);
  else preview.showIntro();
  setPaused(reducedMotion.matches);
  if (wasPracticing) practice.focus();
  else story.focus();
}
gameMenu.onclick = showMenu;

async function start() {
  try {
    const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!context) {
      shell.dataset.state = 'unsupported';
      statusMessage.textContent = 'This preview needs WebGL 2. Enable hardware acceleration or open it in a browser that supports WebGL 2.';
      return;
    }
    const { createPreview } = await import('./game/render/preview');
    if (cancelled) return;
    preview = createPreview(canvas, context, () => showFailure('The scene stopped rendering. Reload to try again.'));
    profile = await openProfile();
    if (cancelled) {
      profile.close();
      return;
    }
    refreshProfile();
    if (campaignStep > 0) preview.showForest(campaignStep);
    setPaused(reducedMotion.matches);
    shell.dataset.state = 'ready';
    statusMessage.textContent = 'Forest clearing ready.';
    motion.hidden = false;
    play.hidden = false;
    story.hidden = false;
    if (profile.profile.pendingPresentationMissionId) openStoryBriefing();
  } catch {
    showFailure('The scene could not start. Check your connection and reload the preview.');
  }
}

void start();
