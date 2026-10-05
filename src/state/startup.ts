/**
 * The form on launch (M3-D5): a setup in the URL hash wins; otherwise the last-applied preset;
 * otherwise blank. The saved profile always fills equity and cash.
 */
import { formatTyped } from '../domain/format';
import { applyPreset } from '../domain/presets';
import type { StoredDoc } from '../domain/schema';
import { decodeSetup } from '../domain/share-url';
import { INITIAL_STATE, withSetup, type CalcState } from './form-reducer';

export type StartupNotice =
  | { readonly kind: 'ignoredValues'; readonly fields: readonly string[] }
  | { readonly kind: 'newerLink' }
  | { readonly kind: 'invalidLink' };

export interface Startup {
  readonly state: CalcState;
  readonly notice: StartupNotice | null;
}

export const startupState = (doc: StoredDoc, hash: string): Startup => {
  const form = {
    ...INITIAL_STATE.form,
    equity: doc.profile.equity === null ? '' : formatTyped(doc.profile.equity),
    availableCash: doc.profile.availableCash === null ? '' : formatTyped(doc.profile.availableCash),
  };

  const link = decodeSetup(hash);
  if (link.kind === 'setup') {
    return {
      state: { ...INITIAL_STATE, form: withSetup(form, link.setup), symbol: link.setup.symbol },
      notice: link.ignored.length > 0 ? { kind: 'ignoredValues', fields: link.ignored } : null,
    };
  }

  const preset = doc.presets.find((p) => p.id === doc.settings.defaultPresetId);
  const base: CalcState = { ...INITIAL_STATE, form: preset ? applyPreset(form, preset) : form };
  if (link.kind === 'newer') return { state: base, notice: { kind: 'newerLink' } };
  if (link.kind === 'invalid') return { state: base, notice: { kind: 'invalidLink' } };
  return { state: base, notice: null };
};
