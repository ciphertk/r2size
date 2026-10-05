import { screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { INFO_TEXT } from '../../domain/messages';
import { App } from '../app/App';
import { GLOSSARY } from '../guide/glossary';
import { bandLabel, GuidePage } from '../guide/GuidePage';
import { renderWithStore as render } from './render';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('glossary', () => {
  it('has an entry for every info tip, so every "More in the Guide" link lands somewhere', () => {
    const ids = new Set(GLOSSARY.map((entry) => entry.id));
    for (const term of Object.keys(INFO_TEXT)) expect(ids).toContain(term);
    expect(ids.size).toBe(GLOSSARY.length); // no duplicate anchors
  });
});

describe('tick band labels (D5, in the circular’s words)', () => {
  it('reads each band with the right inclusive edge', () => {
    expect([0, 1, 2, 3, 4, 5].map(bandLabel)).toEqual([
      'Below ₹250',
      '₹250 to ₹1,000',
      'Above ₹1,000 to ₹5,000',
      'Above ₹5,000 to ₹10,000',
      'Above ₹10,000 to ₹20,000',
      'Above ₹20,000',
    ]);
  });
});

describe('GuidePage', () => {
  it('works the mockup example through the engine, step by step (ADR-008)', () => {
    render(<GuidePage />);
    const steps = screen.getByRole('table', { name: 'Worked example, step by step' });
    const row = (name: RegExp) => within(steps).getByRole('row', { name });
    expect(row(/^Risk budget/)).toHaveTextContent('₹20,000.00');
    expect(row(/^Stop/)).toHaveTextContent('93.00');
    expect(row(/^Risk per share/)).toHaveTextContent('₹7.25');
    expect(row(/^Quantity/)).toHaveTextContent('2,758 shares');
    expect(row(/^Cash cap/)).toHaveTextContent('6,384');
  });

  it('shows the dated NSE table, the privacy promise and the source link', () => {
    render(<GuidePage />);
    expect(screen.getByText(/effective 15 Apr 2025/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'NSE tick size by price band' })).toHaveTextContent(
      '₹5.00',
    );
    expect(screen.getByText(/Nothing you type leaves this device/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'github.com/ciphertk/r2size' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });
});

describe('moving between the calculator and the Guide', () => {
  it('opens the term from an info tip, and Back restores the setup', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#v=1&e=100&sm=pct&sp=7&rm=pct&r=1');
    render(<App />);
    expect(screen.getByLabelText('Entry', { exact: true })).toHaveValue('100');

    await user.click(screen.getByRole('button', { name: 'About Tick size' }));
    await user.click(await screen.findByRole('link', { name: 'More in the Guide →' }));
    expect(window.location.pathname).toBe('/guide');
    expect(window.location.hash).toBe('#term-tick');
    expect(await screen.findByRole('heading', { name: 'Guide', level: 1 })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(await screen.findByLabelText('Entry', { exact: true })).toHaveValue('100');
  });

  it('shows the header Guide link as the current page on /guide', async () => {
    window.history.replaceState(null, '', '/guide');
    render(<App />);
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Settings and data' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Guide', level: 1 })).toBeInTheDocument();
  });
});
