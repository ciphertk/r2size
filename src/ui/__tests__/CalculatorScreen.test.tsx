import { render, screen, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WORKED_EXAMPLES } from '../../engine/__fixtures__/worked-examples';
import { INITIAL_STATE, type CalcState } from '../../state/form-reducer';
import { CalculatorScreen } from '../calculator/CalculatorScreen';

const fixture = (name: string): CalcState => {
  const example = WORKED_EXAMPLES.find((e) => e.name.startsWith(name));
  if (!example) throw new Error(`No worked example "${name}"`);
  return { ...INITIAL_STATE, form: example.raw };
};

const result = () => screen.getByRole('complementary', { name: 'Result' });

describe('CalculatorScreen with the M1 worked examples', () => {
  it('shows the mockup numbers exactly', () => {
    render(<CalculatorScreen initial={{ ...fixture('mockup'), symbol: 'raymond' }} />);
    const panel = result();
    expect(within(panel).getByText('2,758')).toBeInTheDocument();
    expect(panel).toHaveTextContent('RAYMOND @ 100.00 SL 93.00');
    expect(panel).toHaveTextContent('₹19,995.501.00%');
    expect(panel).toHaveTextContent('₹2,75,800.0013.79%');
    expect(panel).toHaveTextContent('₹7.25incl. ₹0.25 cost');
    const ladder = within(panel).getByRole('table', { name: 'Scenarios, not forecasts' });
    expect(within(ladder).getByRole('row', { name: /^\+1R/ })).toHaveTextContent('+18,616.50');
    expect(within(ladder).getByRole('row', { name: /^T1/ })).toHaveTextContent('+50,057.70');
    expect(within(ladder).getByRole('row', { name: /^Stop/ })).toHaveTextContent('−19,995.50');
  });

  it('names a binding cap and the uncapped quantity', () => {
    render(<CalculatorScreen initial={fixture('cash cap binds')} />);
    expect(result()).toHaveTextContent('Limited by available cash · uncapped 4,444');
    expect(within(result()).getByText('2,493')).toBeInTheDocument();
  });

  it.each([
    ['zero quantity: risk budget', 'Your risk budget is too small for 1 share at this stop.'],
    ['zero quantity: allocation', 'Max allocation is too small to buy 1 share at this entry.'],
    ['zero quantity: not enough cash', 'Not enough available cash to buy 1 share at this entry.'],
  ])('explains %s', (name, message) => {
    render(<CalculatorScreen initial={fixture(name)} />);
    expect(within(result()).getByRole('alert')).toHaveTextContent(message);
  });

  it('lists what is still needed on an empty form', () => {
    render(<CalculatorScreen />);
    expect(result()).toHaveTextContent(
      'Still needed: Entry, Stop % below entry, Equity, Risk % of equity.',
    );
  });
});

describe('typing', () => {
  it('keeps typed text while focused and groups it after', async () => {
    const user = userEvent.setup();
    render(<CalculatorScreen />);
    const equity = screen.getByLabelText('Equity', { exact: true });
    await user.type(equity, '2000000');
    expect(equity).toHaveValue('2000000');
    await user.tab();
    expect(equity).toHaveValue('20,00,000');
  });

  it('shows a field error only after the field is left (M2-D5)', async () => {
    const user = userEvent.setup();
    render(<CalculatorScreen />);
    const entry = screen.getByLabelText('Entry', { exact: true });
    await user.type(entry, 'abc');
    expect(screen.queryByText('Enter a number, like 1250.50.')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText('Enter a number, like 1250.50.')).toBeInTheDocument();
    expect(entry).toHaveAttribute('aria-invalid', 'true');
  });

  it('switches stop methods and shows the derived stop', async () => {
    const user = userEvent.setup();
    render(<CalculatorScreen />);
    await user.type(screen.getByLabelText('Entry', { exact: true }), '512.35');
    await user.click(screen.getByRole('radio', { name: 'ATR ×' }));
    await user.type(screen.getByLabelText('ATR', { exact: true }), '7.33');
    await user.type(screen.getByLabelText('ATR multiple'), '1.5');
    expect(screen.getByText('501.35')).toBeInTheDocument();
    expect(screen.getByText(/stop rounded down to the tick/)).toBeInTheDocument();
  });
});
