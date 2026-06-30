import { buildSponsorSlot, buildSponsorMailto } from './revenueExperiments';

test('buildSponsorSlot returns a low-risk sponsor CTA for high inventory pages', () => {
  const slot = buildSponsorSlot({ tournamentsCount: 75, playsLogged: 1200 });
  expect(slot.enabled).toBe(true);
  expect(slot.title).toContain('Sponsor');
  expect(slot.disclaimer).toContain('No payments');
});

test('buildSponsorMailto encodes sponsor inquiry details', () => {
  const url = buildSponsorMailto({ title: 'Sponsor a bracket', source: 'home' });
  expect(url).toContain('mailto:');
  expect(url).toContain('subject=');
  expect(url).toContain('Sponsor%20a%20bracket');
  expect(url).toContain('source%3A%20home');
});
