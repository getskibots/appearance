/* Local demo/test harness for the BotScrew drop-in AppearanceTab.
 * Renders the component beside a live view of the BotScrew widgetSettings it
 * produces (the PATCH /bot/{botId}/widget payload), with a botType toggle to
 * exercise the AI_AGENT rating gate. Seeded from the dashboard's localStorage
 * output (gsb_widget_settings) so editing in the vanilla dashboard and this
 * React tab share the same contract. NOT part of the drop-in itself. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppearanceTab from './AppearanceTab.jsx';

function seed() {
  try {
    const raw = localStorage.getItem('gsb_widget_settings');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {
    isComposerInputEnabled: true,
    languageConfigs: {
      English: {
        imageUrl: '',
        color: '#a41e23',
        widgetName: 'Jackson Hole Support',
        inputPlaceholder: 'Ask me a JH question',
        doEnableSoundNotifications: true,
        doShowPopupMessagePreview: false,
        doAskForRating: false,
        greetingMessagePopupSettings: {
          popupLogoUrl: null, popupLogoSize: 64, alignment: 'Right', bottomSpacing: 32, sideSpacing: 32,
        },
      },
    },
    gsbAppearance: {},
  };
}

function Demo() {
  const [settings, setSettings] = useState(seed);
  const [botType, setBotType] = useState('AI_AGENT');
  const btn = (active) => ({
    padding: '4px 10px', fontSize: 12, fontFamily: 'Lato, sans-serif',
    border: '1px solid #d0d4da', borderRadius: 6, cursor: active ? 'default' : 'pointer',
    background: active ? '#1f7ae0' : '#fff', color: active ? '#fff' : '#374151',
  });
  return (
    <div style={{ display: 'flex', gap: 32, padding: 24, alignItems: 'flex-start', fontFamily: 'Lato, sans-serif' }}>
      <div style={{ flex: '0 0 560px' }}>
        <div style={{ marginBottom: 14, fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>botType:</span>
          <button style={btn(botType === 'AI_AGENT')} onClick={() => setBotType('AI_AGENT')}>AI_AGENT</button>
          <button style={btn(botType === 'FLOW')} onClick={() => setBotType('FLOW')}>FLOW (shows rating)</button>
        </div>
        <AppearanceTab settings={settings} botType={botType} onChange={setSettings} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, fontFamily: 'Lato, sans-serif' }}>
          widgetSettings (live PATCH payload)
        </div>
        <pre style={{ maxHeight: '88vh', overflow: 'auto', background: '#0f1117', color: '#cbd5e1', padding: 16, borderRadius: 8, fontSize: 11, lineHeight: 1.5, margin: 0 }}>
          {JSON.stringify(settings, null, 2)}
        </pre>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
