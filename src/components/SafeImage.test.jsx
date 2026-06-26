import { render, screen } from '@testing-library/react';
import SafeImage from './SafeImage';

test('renders a branded placeholder when no image source is available', () => {
  render(<SafeImage alt="Pizza" style={{ width: 40, height: 40 }} />);

  const placeholder = screen.getByRole('img', { name: 'Pizza' });
  expect(placeholder).toHaveTextContent('P');
  expect(placeholder.tagName).toBe('DIV');
});

test('renders an img when a source is available', () => {
  render(<SafeImage src="https://example.com/pizza.png" alt="Pizza" />);

  const image = screen.getByRole('img', { name: 'Pizza' });
  expect(image.tagName).toBe('IMG');
  expect(image).toHaveAttribute('src', 'https://example.com/pizza.png');
});
