import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { computeSizing, previewStop } from '../../engine';
import { formatTyped } from '../../domain/format';
import { LINK_NOTICE_TEXT, NOTICE_TEXT } from '../../domain/messages';
import { draftFromForm, draftFromPreset, type PresetDraft } from '../../domain/presets';
import type { Preset } from '../../domain/schema';
import { encodeSetup } from '../../domain/share-url';
import { createHashWriter } from '../../infra/url-hash';
import { useAppState, useAppStore } from '../../state/app-store';
import { calcReducer, INITIAL_STATE, setupOf, type CalcState } from '../../state/form-reducer';
import type { StartupNotice } from '../../state/startup';
import { PresetChips } from '../presets/PresetChips';
import { PresetEditor } from '../presets/PresetEditor';
import { ProfileStrip } from '../profile/ProfileStrip';
import { SettingsSheet } from '../settings/SettingsSheet';
import { NoticeBar } from '../shared/NoticeBar';
import styles from './CalculatorScreen.module.css';
import { CommandBar } from './CommandBar';
import { Dock } from './Dock';
import { InputsPanel } from './InputsPanel';
import { LadderPane } from './LadderPane';
import { ResultPanel } from './ResultPanel';

export interface CalculatorScreenProps {
  readonly initial?: CalcState;
  readonly startupNotice?: StartupNotice | null;
  readonly settingsOpen?: boolean;
  readonly onSettingsOpenChange?: (open: boolean) => void;
}

type EditorState =
  | { readonly open: false }
  | { readonly open: true; readonly mode: 'new'; readonly draft: PresetDraft }
  | {
      readonly open: true;
      readonly mode: 'edit';
      readonly draft: PresetDraft;
      readonly id: string;
    };

const linkNoticeText = (notice: StartupNotice): string =>
  notice.kind === 'ignoredValues'
    ? LINK_NOTICE_TEXT.ignoredValues(notice.fields)
    : LINK_NOTICE_TEXT[notice.kind];

const shown = (value: string | null) => (value === null ? '' : formatTyped(value));

/** The single screen: everything typed lives here; what is remembered lives in the app store. */
export function CalculatorScreen({
  initial = INITIAL_STATE,
  startupNotice = null,
  settingsOpen = false,
  onSettingsOpenChange = () => undefined,
}: CalculatorScreenProps) {
  const store = useAppStore();
  const app = useAppState();
  const [state, dispatch] = useReducer(calcReducer, initial);
  const [linkNotice, setLinkNotice] = useState(startupNotice);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const outcome = useMemo(() => computeSizing(state.form), [state.form]);
  const preview = useMemo(() => previewStop(state.form), [state.form]);
  const context = { state, dispatch, outcome };

  // The setup lives in the URL hash, so a reload or a shared link brings it back (ADR-005).
  const writer = useMemo(() => createHashWriter(), []);
  const hash = encodeSetup(setupOf(state));
  useEffect(() => writer.write(hash), [writer, hash]);
  useEffect(() => () => writer.flush(), [writer]);

  // Profile changes made elsewhere (import, reset, another tab) flow into the form. Startup
  // already filled it, and saves made from this form are recorded as synced (saveProfile
  // below), so a save never writes back over a field the trader is still typing in.
  const { equity, availableCash } = app.doc.profile;
  const syncedProfile = useRef({ equity, availableCash });
  useEffect(() => {
    const last = syncedProfile.current;
    if (last.equity === equity && last.availableCash === availableCash) return;
    syncedProfile.current = { equity, availableCash };
    dispatch({ type: 'setProfile', equity: shown(equity), availableCash: shown(availableCash) });
  }, [equity, availableCash]);

  const saveProfile = (equityText: string, cashText: string) => {
    store.actions.saveProfile(equityText, cashText);
    const saved = store.getState().doc.profile;
    syncedProfile.current = { equity: saved.equity, availableCash: saved.availableCash };
  };

  // A reset clears the trade and the link too.
  useEffect(() => {
    if (app.notice === 'reset') dispatch({ type: 'clearTrade' });
  }, [app.notice]);

  const applyPreset = (preset: Preset) => {
    dispatch({ type: 'applyPreset', preset });
    store.actions.setDefaultPreset(preset.id);
  };

  const editPreset = (preset: Preset) => {
    onSettingsOpenChange(false);
    setEditor({ open: true, mode: 'edit', draft: draftFromPreset(preset), id: preset.id });
  };

  const shareLink = () => {
    writer.flush();
    return `${window.location.origin}${window.location.pathname}${encodeSetup(setupOf(state))}`;
  };

  return (
    <div className={styles.screen}>
      <div className={styles.layout}>
        <div className={styles.setup}>
          {app.notice && (
            <NoticeBar
              text={NOTICE_TEXT[app.notice]}
              tone={['imported', 'importUndone', 'reset'].includes(app.notice) ? 'info' : 'caution'}
              onDismiss={() => store.actions.dismissNotice()}
            />
          )}
          {linkNotice && (
            <NoticeBar
              text={linkNoticeText(linkNotice)}
              tone="caution"
              onDismiss={() => setLinkNotice(null)}
            />
          )}
          <CommandBar
            state={state}
            dispatch={dispatch}
            onApplied={(next, actions) => {
              // Equity and cash typed on the line are remembered, like typing them in the fields.
              const touchesProfile = actions.some(
                (a) =>
                  a.type === 'setField' && (a.field === 'equity' || a.field === 'availableCash'),
              );
              if (touchesProfile) {
                saveProfile(next.form.equity, next.form.availableCash);
              }
            }}
          />
          <PresetChips
            presets={app.doc.presets}
            form={state.form}
            onApply={applyPreset}
            onNew={() => setEditor({ open: true, mode: 'new', draft: draftFromForm(state.form) })}
          />
        </div>
        <div className={styles.ladder}>
          <LadderPane
            state={state}
            preview={preview}
            result={outcome.ok ? outcome.result : null}
            dispatch={dispatch}
          />
        </div>
        <div className={styles.fields}>
          <InputsPanel
            {...context}
            preview={preview}
            account={<ProfileStrip {...context} onSave={saveProfile} />}
          />
        </div>
        <div className={styles.result}>
          <ResultPanel outcome={outcome} symbol={state.symbol} shareLink={shareLink} />
        </div>
      </div>
      {outcome.ok && <Dock result={outcome.result} />}

      <PresetEditor
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) setEditor({ open: false });
        }}
        mode={editor.open ? editor.mode : 'new'}
        initial={editor.open ? editor.draft : draftFromForm(state.form)}
        onSave={(fields) => {
          if (!editor.open) return;
          if (editor.mode === 'edit') {
            store.actions.updatePreset(editor.id, fields);
          } else {
            const id = store.actions.createPreset(fields);
            if (id !== null) {
              dispatch({ type: 'applyPreset', preset: fields });
              store.actions.setDefaultPreset(id);
            }
          }
        }}
        onDelete={
          editor.open && editor.mode === 'edit'
            ? () => store.actions.deletePreset(editor.id)
            : undefined
        }
      />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        onEditPreset={editPreset}
      />
    </div>
  );
}
