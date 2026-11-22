import type { Language } from '../game/core/types';

const copy = {
  title: ['Light Hunt', 'شکار نور'],
  loading: ['Loading the clearing…', 'در حال آماده‌سازی جنگل…'],
  reload: ['Reload preview', 'بارگذاری دوباره'],
  ready: ['Forest clearing ready.', 'جنگل آماده است.'],
  webgl: ['This preview needs WebGL 2. Enable hardware acceleration or open it in a browser that supports WebGL 2.', 'این بازی به WebGL 2 نیاز دارد. شتاب‌دهی سخت‌افزاری را فعال کنید یا از مرورگر سازگار استفاده کنید.'],
  graphicsLost: ['The graphics connection was interrupted. Reload to return to the clearing.', 'ارتباط گرافیکی قطع شد. برای بازگشت به جنگل، صفحه را دوباره بارگذاری کنید.'],
  renderFailed: ['The scene stopped rendering. Reload to try again.', 'نمایش صحنه متوقف شد. صفحه را دوباره بارگذاری کنید.'],
  loadFailed: ['The scene could not start. Check your connection and reload the preview.', 'صحنه باز نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'],
  gameFailed: ['The clearing could not start. Reload the preview to try again.', 'بازی شروع نشد. برای تلاش دوباره، صفحه را بارگذاری کنید.'],
  introLabel: ['A golden firefly hovering among reeds in a blue-green clearing', 'کرم شب‌تاب طلایی میان نی‌های جنگل'],
  forestField: ['Forest playfield', 'محیط بازی جنگل'],
  tunnelField: ['Tunnel playfield', 'محیط بازی تونل'],
  clearing: ['Forest clearing', 'محوطهٔ جنگل'],
  underground: ['Under the forest', 'زیر جنگل'],
  startExploring: ['Start exploring · Tutorial', 'آموزش بازی'],
  tutorial: ['Tutorial', 'آموزش'],
  playStory: ['Play story', 'شروع داستان'],
  continueStory: ['Continue story', 'ادامهٔ داستان'],
  viewForest: ['View forest', 'دیدن جنگل'],
  shop: ['Shop', 'فروشگاه'],
  practice: ['Practice', 'تمرین'],
  practiceDark: ['Revisit a mission in its original darkness. The forest stays restored.', 'مأموریت را در تاریکی آغازین دوباره بازی کنید. جنگل روشن می‌ماند.'],
  settings: ['Settings', 'تنظیمات'],
  sound: ['Sound effects', 'جلوه‌های صوتی'],
  motionSetting: ['Reduce motion', 'کاهش حرکت'],
  systemMotion: ['Your device requests reduced motion.', 'کاهش حرکت در تنظیمات دستگاه فعال است.'],
  pointerSensitivity: ['Pointer sensitivity', 'حساسیت ماوس و لمس'],
  gentle: ['Gentle', 'کم'],
  standard: ['Standard', 'عادی'],
  quick: ['Quick', 'زیاد'],
  customSensitivity: ['Saved ({0}×)', 'ذخیره‌شده ({0}×)'],
  language: ['Language', 'زبان'],
  localSave: ['Progress saves in this browser.', 'پیشرفت شما در همین مرورگر ذخیره می‌شود.'],
  pauseMotion: ['Pause motion', 'توقف حرکت'],
  resumeMotion: ['Resume motion', 'ادامهٔ حرکت'],
  pause: ['Pause', 'توقف'],
  resume: ['Resume', 'ادامه'],
  retry: ['Try again', 'تلاش دوباره'],
  back: ['Back', 'بازگشت'],
  menu: ['Back to menu', 'بازگشت به فهرست'],
  returnForest: ['Return to forest', 'بازگشت به جنگل'],
  backClearing: ['Back to clearing', 'بازگشت به محوطه'],
  nextMission: ['Next mission', 'مأموریت بعدی'],
  startMission: ['Start mission', 'شروع مأموریت'],
  startPractice: ['Start practice', 'شروع تمرین'],
  missionOf: ['Mission {0} of {1}', 'مأموریت {0} از {1}'],
  missionNumber: ['Mission {0}', 'مأموریت {0}'],
  practiceMission: ['Practice mission {0}', 'تمرین مأموریت {0}'],
  openingStory: ['The Wizard of Darkness hid the forest’s light. Bring it back to the guardian.', 'جادوگر تاریکی نور جنگل را پنهان کرده است. نور را به نگهبان برگردانید.'],
  findTunnels: ['Find a tunnel entrance and steer toward the lights.', 'یک دهانه پیدا کنید و در تونل به سوی نورها بروید.'],
  briefGoal: ['Light target', 'هدف نور'],
  briefTime: ['Active time', 'زمان فعال'],
  briefTunnels: ['Tunnels', 'تونل‌ها'],
  briefLightCount: ['{0} of {1}', '{0} از {1}'],
  briefTimeCount: ['{0} sec', '{0} ثانیه'],
  briefTunnelCount: ['{0}', '{0}'],
  practiceBrief: ['Practice pays no story rewards.', 'تمرین پاداش داستانی ندارد.'],
  equipment: ['Equipment: {0}', 'تجهیزات: {0}'],
  baseEquipment: ['Standard firefly', 'کرم شب‌تاب معمولی'],
  bestEquipment: ['Best with this equipment: {0} lights.', 'بهترین نتیجه با این تجهیزات: {0} نور.'],
  activeTime: ['Active time remaining', 'زمان فعال باقی‌مانده'],
  lights: ['{0} / {1} lights', '{0} از {1} نور'],
  target: ['Target {0}', 'هدف {0}'],
  crystals: ['{0} crystals', '{0} بلور'],
  progress: ['Forest restored: {0} / 3 · {1} crystals', 'بخش‌های روشن جنگل: {0} از ۳ · {1} بلور'],
  restored: ['Forest restored', 'جنگل دوباره روشن شد'],
  savedForest: ['The guardian’s torch is steady. Your crystals stay with your local forest.', 'مشعل نگهبان روشن مانده و بلورهایی که به دست آورده‌اید مال شماست.'],
  elixirDelivered: ['Elixir delivered', 'اکسیر تحویل داده شد'],
  firstElixir: ['The guardian took the first elixir. Light now reaches the near bank.', 'نگهبان اولین اکسیر را گرفت. حالا کنارهٔ آب هم روشن است.'],
  secondElixir: ['The guardian took the second elixir. Light spreads deeper into the forest.', 'نگهبان دومین اکسیر را گرفت. حالا نور به دل جنگل هم می‌رسد.'],
  thirdElixir: ['The third elixir steadied the guardian’s torch. The restored forest earned you 12 crystals.', 'اکسیر سوم مشعل نگهبان را روشن نگه داشت. برای روشن کردن جنگل ۱۲ بلور گرفتید.'],
  rewardLimit: ['The guardian’s reward buys one upgrade.', 'با پاداش نگهبان می‌توانید یک ارتقا بخرید.'],
  explorationRadius: ['Exploration light radius', 'شعاع نور جست‌وجو'],
  explorationEffect: ['Reveal openings 10% farther away.', 'دهانه‌ها را از ۱۰٪ دورتر پیدا کنید.'],
  collectionRadius: ['Collection radius', 'شعاع جمع‌آوری'],
  collectionEffect: ['Catch lights from 10% farther away.', 'نورها را از ۱۰٪ دورتر بگیرید.'],
  buy: ['Buy for {0} crystals', 'خرید با {0} بلور'],
  owned: ['Owned', 'خریداری شده'],
  crystalShortfall: ['Need {0} more crystals', '{0} بلور دیگر لازم است'],
  equipped: ['Upgrade equipped for your next practice run.', 'ارتقا در تمرین بعدی فعال است.'],
  alreadyOwned: ['You already own this upgrade.', 'این ارتقا را دارید.'],
  insufficient: ['You need more crystals.', 'بلور بیشتری لازم دارید.'],
  shopUnavailable: ['The shop is unavailable in this tab.', 'فروشگاه در این زبانه در دسترس نیست.'],
  busySave: ['Another tab has the forest open. Story progress is read-only here.', 'بازی در زبانهٔ دیگری باز است. برای ادامهٔ داستان به همان زبانه برگردید.'],
  corruptSave: ['The forest save could not be read. The saved data is still here.', 'داده‌های ذخیره‌شده خوانده نشدند و همچنان در مرورگر هستند.'],
  futureSave: ['This save belongs to a newer version of Light Hunt. The saved data is still here.', 'این ذخیره برای نسخهٔ جدیدتر شکار نور است و داده‌ها همچنان در مرورگر هستند.'],
  unavailableSave: ['This browser cannot access safe local saving.', 'ذخیرهٔ امن در این مرورگر در دسترس نیست.'],
  memorySave: ['Could not save progress. New progress will only be available in this tab.', 'پیشرفت ذخیره نشد و فقط در همین زبانه در دسترس است.'],
  playUnsaved: ['Play without saving', 'بازی بدون ذخیره'],
  gamePaused: ['Paused. Resume when you’re ready.', 'بازی متوقف است. هر وقت آماده‌اید ادامه دهید.'],
  reachedTarget: ['You reached the target.', 'به هدف رسیدید.'],
  deadline: ['Time ran out before you reached the target.', 'پیش از رسیدن به هدف، زمان تمام شد.'],
  unreachable: ['There are too few lights left in the unopened tunnels to reach the target.', 'در تونل‌های باقی‌مانده نور کافی برای رسیدن به هدف نیست.'],
  deadlineTip: ['Search the far side of the clearing first to find a tunnel sooner.', 'برای پیدا کردن سریع‌تر تونل، اول بخش دورتر محوطه را بگردید.'],
  steeringTip: ['Start steering toward the next light a little earlier.', 'کمی زودتر به سوی نور بعدی حرکت کنید.'],
  formingElixir: ['The lights formed an elixir. Returning to the guardian…', 'نورها به اکسیر تبدیل شدند. در راه بازگشت به نگهبان…'],
  returning: ['Returning to the clearing…', 'در راه بازگشت به محوطه…'],
  dropping: ['Dropping into the tunnel…', 'در حال ورود به تونل…'],
  tunnelReady: ['Move the mouse, touch the tunnel, or press Left or Right to start.', 'برای شروع، ماوس را حرکت دهید، تونل را لمس کنید یا کلید چپ یا راست را بزنید.'],
  tunnelSteer: ['Steer left and right to catch the lights.', 'برای گرفتن نورها به چپ و راست حرکت کنید.'],
  releaseCue: ['Release here, or press Space.', 'اینجا رها کنید یا کلید فاصله را بزنید.'],
  invalidRelease: ['Whoops! Release over an opening when its ring appears.', 'وقتی حلقهٔ دهانه پیدا شد، روی آن رها کنید.'],
  exploreHint: ['Hold and drag, or use the arrow keys. Look for an opening in the clearing.', 'نگه دارید و بکشید، یا از کلیدهای جهت استفاده کنید. یک دهانه در محوطه پیدا کنید.'],
  tutorialExplore: ['Take your time. Drag or use the arrow keys to find the opening.', 'عجله‌ای نیست. با کشیدن یا کلیدهای جهت دهانه را پیدا کنید.'],
  tutorialReady: ['Touch again, move the mouse, or press Left or Right to start.', 'برای شروع، دوباره صفحه را لمس کنید، ماوس را حرکت دهید یا یکی از کلیدهای چپ و راست را بزنید.'],
  tutorialSteer: ['Steer left and right toward the lights. Lifting your finger keeps you moving.', 'به چپ و راست به سوی نورها بروید. با برداشتن انگشت، حرکت ادامه دارد.'],
  tutorialSummary: ['You caught {0} of {1} lights. In story missions, reach the light target in 90 active seconds.', 'از {1} نور، {0} نور گرفتید. در داستان، در ۹۰ ثانیهٔ فعال به هدف جمع‌آوری نور برسید.'],
  tutorialComplete: ['Tutorial complete', 'آموزش تمام شد'],
  missionComplete: ['Mission complete', 'مأموریت انجام شد'],
  missionFailed: ['Mission failed', 'مأموریت ناموفق بود'],
  practiceComplete: ['Practice complete', 'تمرین انجام شد'],
  practiceFailed: ['Practice failed', 'تمرین ناموفق بود'],
} as const;

export type CopyKey = keyof typeof copy;

let language: Language = 'fa';
const numbers = { fa: new Intl.NumberFormat('fa', { useGrouping: false }), en: new Intl.NumberFormat('en', { useGrouping: false }) };
const seconds = { fa: new Intl.NumberFormat('fa', { minimumIntegerDigits: 2 }), en: new Intl.NumberFormat('en', { minimumIntegerDigits: 2 }) };

export function resolveLanguage(requested: string | null, saved?: Language): Language {
  return requested === 'fa' || requested === 'en' ? requested : saved ?? 'fa';
}

export function setLanguage(value: Language) {
  language = value;
}

export function formatClock(totalSeconds: number): string {
  return numbers[language].format(Math.floor(totalSeconds / 60)) + ':' + seconds[language].format(totalSeconds % 60);
}

export function t(key: CopyKey, ...values: (string | number)[]): string {
  return copy[key][language === 'fa' ? 1 : 0].replace(/\{(\d+)\}/g, (_, index: string) => {
    const value = values[Number(index)];
    return typeof value === 'number' ? numbers[language].format(value) : value ?? '';
  });
}
