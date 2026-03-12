import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the JARVIS auth screen', () => {
  render(<App />);
  expect(screen.getByText(/JARVIS/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});
