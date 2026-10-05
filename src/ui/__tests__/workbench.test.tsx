import { fireEvent, screen, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WORKED_EXAMPLES } from '../../engine/__fixtures__/worked-examples';
import { INITIAL_STATE, type CalcState } from '../../state/form-reducer';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import { snapToTick } from '../calculator/use-ladder';
import { renderWithStore as render } from './render';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

const mockup = (): CalcState => {
  const example = WORKED_EXAMPLES.find((e) => e.name.startsWith('mockup'));
  if (!example) throw new Error('No mockup example');
  return { ...INITIAL_STATE, symbol: 'RAYMOND', form: example.raw };
};

const field = (label: string) => screen.getByLabelText(label, { exact: true });
const qty = () => document.getElementById('ticket-qty')?.textContent ?? '';

describe('snapToTick', () => {
  it('rounds to the nearest tick in whole paise, as an exact string', () => {
    expect(snapToTick(93.004, 1)).toBe('93.00');
    expect(snapToTick(93.006, 1)).toBe('93.01');
    expect(snapToTick(93.03, 5)).toBe('93.05');
    expect(snapToTick(1234.567, 1)).toBe('1234.57');
    expect(snapToTick(0.1 + 0.2, 1)).toBe('0.30'); // no float residue
  });
});

describe('quick setup line', () => {
  it('fills the form from one line and remembers equity like the field does', async () => {
    const user = userEvent.setup();
    const { store } = render(<CalculatorScreen />);
    await user.type(
      screen.getByRole('textbox', { name: 'Quick setup' }),
      'raymond 100 sl 7% risk 1% eq 2000000{Enter}',
    );
    expect(field('Symbol')).toHaveValue('RAYMOND');
    expect(field('Entry')).toHaveValue('100');
    expect(field('Stop % below entry')).toHaveValue('7');
    expect(qty()).toContain('2,857');
    expect(store.getState().doc.profile.equity).toBe('2000000');
  });

  it('shows what it understood before Enter, and changes nothing until then', async () => {
    const user = userEvent.setup();
    render(<CalculatorScreen />);
    await user.type(screen.getByRole('textbox', { name: 'Quick setup' }), 'tcs 4012.50 sl 3890');
    expect(screen.getByText('₹3,890')).toBeInTheDocument();
    expect(field('Entry')).toHaveValue('');
  });
});

describe('price ladder', () => {
  it('nudges the stop one tick with ↑, ten with ⇧↓, switching the stop to a price', () => {
    render(<CalculatorScreen initial={mockup()} />);
    const stop = screen.getByRole('slider', { name: 'Stop line' });
    expect(stop).toHaveAttribute('aria-valuetext', 'Stop ₹93.00');
    fireEvent.keyDown(stop, { key: 'ArrowUp' });
    expect(screen.getByRole('radio', { name: 'Price' })).toBeChecked();
    expect(field('Stop price')).toHaveValue('93.01');
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Stop line' }), {
      key: 'ArrowDown',
      shiftKey: true,
    });
    expect(field('Stop price')).toHaveValue('92.91');
  });

  it('moves the entry and target, and the quantity follows', () => {
    render(<CalculatorScreen initial={mockup()} />);
    expect(qty()).toContain('2,758');
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Target line' }), { key: 'PageUp' });
    expect(field('Target 1')).toHaveValue('118.50');
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Entry line' }), { key: 'ArrowUp' });
    expect(field('Entry')).toHaveValue('100.01');
    expect(qty()).not.toContain('2,758'); // a % stop moves with the entry: new risk per share
  });

  it('never lets the stop reach the entry', () => {
    render(<CalculatorScreen initial={mockup()} />);
    for (let i = 0; i < 80; i += 1) {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Stop line' }), {
        key: 'ArrowUp',
        shiftKey: true,
      });
    }
    expect(field('Stop price')).toHaveValue('99.99');
  });
});

describe('copy shortcuts', () => {
  it('copies with C / E / S / A, but not while typing in a field', async () => {
    const user = userEvent.setup();
    render(<CalculatorScreen initial={mockup()} />);
    await user.keyboard('c');
    expect(await navigator.clipboard.readText()).toBe('2758');
    expect(within(screen.getByRole('complementary', { name: 'Result' })).getByText('Copied ✓'));
    await user.keyboard('s');
    expect(await navigator.clipboard.readText()).toBe('93.00');
    await user.keyboard('a');
    expect(await navigator.clipboard.readText()).toContain('RAYMOND');

    await user.click(field('Entry'));
    await user.keyboard('e');
    expect(await navigator.clipboard.readText()).not.toBe('100.00');
  });
});

describe('profile saving', () => {
  // The race this guards against (a save's sync landing after the next field was typed) needs
  // real browser timing; e2e/remembers.spec.ts reproduces it. This checks the end state.
  it('never clears a field while the trader is typing the next one', async () => {
    const user = userEvent.setup();
    const { store } = render(<CalculatorScreen />);
    await user.type(field('Equity'), '2000000');
    await user.click(field('Available cash (optional)'));
    await user.type(field('Available cash (optional)'), '640000');
    await new Promise((resolve) => setTimeout(resolve, 50)); // let effects run
    expect(field('Available cash (optional)')).toHaveValue('640000');
    await user.tab();
    expect(store.getState().doc.profile).toMatchObject({
      equity: '2000000',
      availableCash: '640000',
    });
  });
});
