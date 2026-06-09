/*
 * AppearanceTab — React drop-in for BotScrew's Widget → Appearance tab.
 *
 * Controlled component: it operates directly on BotScrew's `widgetSettings`
 * shape (see docs/botscrew-widget-settings.md / src/shared/widget-config.js) and
 * reports edits via onChange. Conventions match the live BotScrew bundle: React
 * function component + hooks, CSS Modules, per-language config, the global
 * `isComposerInputEnabled` "Disable text input" checkbox, and `doAskForRating`
 * hidden for AI_AGENT bots. Field labels are the exact strings from their build.
 *
 * Slice 1 covers the BotScrew-NATIVE fields. The GSB-only controls (snowfall,
 * typography, bubble styles, embeddables — the `gsbAppearance` block) and the
 * live widget preview land in later slices.
 *
 * Props:
 *   settings      WidgetSettings  { isComposerInputEnabled, languageConfigs, gsbAppearance }
 *   lang          string          language key (default "English")
 *   botType       string          "AI_AGENT" hides the rating toggle
 *   onChange      (next) => void  called with the updated settings on every edit
 *   onUploadLogo  (File) => Promise<string>  returns the uploaded image URL
 */
import styles from './AppearanceTab.module.css';

function patchLang(settings, lang, patch) {
  return {
    ...settings,
    languageConfigs: {
      ...settings.languageConfigs,
      [lang]: { ...settings.languageConfigs[lang], ...patch },
    },
  };
}

function patchGreeting(settings, lang, patch) {
  const lc = settings.languageConfigs[lang] || {};
  return patchLang(settings, lang, {
    greetingMessagePopupSettings: { ...lc.greetingMessagePopupSettings, ...patch },
  });
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className={styles.checkRow}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function AppearanceTab({
  settings,
  lang = 'English',
  botType = 'AI_AGENT',
  onChange,
  onUploadLogo,
}) {
  const lc = (settings.languageConfigs && settings.languageConfigs[lang]) || {};
  const gp = lc.greetingMessagePopupSettings || {};
  const emit = (next) => onChange && onChange(next);
  const setLang = (field, value) => emit(patchLang(settings, lang, { [field]: value }));
  const setGreeting = (field, value) => emit(patchGreeting(settings, lang, { [field]: value }));

  async function handleLogo(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    let url;
    if (onUploadLogo) {
      url = await onUploadLogo(file); // BotScrew: POST /file/widgetLogo
    } else {
      url = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(file);
      });
    }
    if (url) setLang('imageUrl', url);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Appearance</h2>
        <span className={styles.langChip}>{lang}</span>
      </div>

      {/* Logo */}
      <section className={styles.section}>
        <div className={styles.label}>Logo</div>
        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            {lc.imageUrl ? <img src={lc.imageUrl} alt="logo" /> : <span className="material-icons">image</span>}
          </div>
          <label className={styles.uploadBtn}>
            Upload logo
            <input type="file" accept="image/*" hidden onChange={handleLogo} />
          </label>
        </div>
      </section>

      {/* Name */}
      <section className={styles.section}>
        <div className={styles.label}>Name</div>
        <input
          className={styles.input}
          type="text"
          value={lc.widgetName || ''}
          placeholder="Agent"
          onChange={(e) => setLang('widgetName', e.target.value)}
        />
      </section>

      {/* Input placeholder */}
      <section className={styles.section}>
        <div className={styles.label}>Input placeholder</div>
        <input
          className={styles.input}
          type="text"
          value={lc.inputPlaceholder || ''}
          placeholder="Write your reply"
          onChange={(e) => setLang('inputPlaceholder', e.target.value)}
        />
      </section>

      {/* Color */}
      <section className={styles.section}>
        <div className={styles.label}>Color</div>
        <div className={styles.colorRow}>
          <input
            className={styles.colorHex}
            type="text"
            value={lc.color || ''}
            onChange={(e) => setLang('color', e.target.value)}
          />
          <label className={styles.swatch} style={{ background: lc.color || '#000' }}>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(lc.color || '') ? lc.color : '#000000'}
              onChange={(e) => setLang('color', e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* Behavior toggles */}
      <section className={styles.section}>
        <Checkbox
          label="Enable sound notifications"
          checked={lc.doEnableSoundNotifications}
          onChange={(v) => setLang('doEnableSoundNotifications', v)}
        />
        <Checkbox
          label="Show pop-up message preview"
          checked={lc.doShowPopupMessagePreview}
          onChange={(v) => setLang('doShowPopupMessagePreview', v)}
        />
        {/* doAskForRating renders only for non-AI_AGENT bots (matches BotScrew) */}
        {botType !== 'AI_AGENT' && (
          <Checkbox
            label="Ask for rating after conversation ends"
            checked={lc.doAskForRating}
            onChange={(v) => setLang('doAskForRating', v)}
          />
        )}
      </section>

      {/* Greeting message popup */}
      <section className={styles.section}>
        <div className={styles.label}>Greeting message popup</div>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <span className={styles.subLabel}>Logo size (px)</span>
            <input
              className={styles.input}
              type="number" min={40} max={100}
              value={gp.popupLogoSize ?? 64}
              onChange={(e) => setGreeting('popupLogoSize', Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.subLabel}>Alignment</span>
            <div className={styles.segmented}>
              {['Left', 'Right'].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={(gp.alignment || 'Right') === a ? styles.segOn : styles.seg}
                  onClick={() => setGreeting('alignment', a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.subLabel}>Bottom spacing (px)</span>
            <input
              className={styles.input}
              type="number" min={24} max={300}
              value={gp.bottomSpacing ?? 32}
              onChange={(e) => setGreeting('bottomSpacing', Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.subLabel}>Side spacing (px)</span>
            <input
              className={styles.input}
              type="number" min={24} max={300}
              value={gp.sideSpacing ?? 32}
              onChange={(e) => setGreeting('sideSpacing', Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* Global — disable text input for ALL languages */}
      <section className={styles.section}>
        <Checkbox
          label="Disable text input (for all languages)"
          checked={!settings.isComposerInputEnabled}
          onChange={(v) => emit({ ...settings, isComposerInputEnabled: !v })}
        />
      </section>
    </div>
  );
}
