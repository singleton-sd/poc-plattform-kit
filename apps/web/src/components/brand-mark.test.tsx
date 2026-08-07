import { render, screen } from '@testing-library/react';
import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('renders the Platform Kit wordmark with an accent period', () => {
    render(<BrandMark />);

    const mark = screen.getByTestId('brand-mark');
    expect(mark).toHaveTextContent('Platform Kit.');
    expect(mark.querySelector('.text-accent')).toHaveTextContent('.');
  });
});
