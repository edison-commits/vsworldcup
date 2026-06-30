export function buildSponsorSlot({ tournamentsCount = 0, playsLogged = 0 } = {}) {
  const enabled = tournamentsCount >= 20 || playsLogged >= 500;
  return {
    enabled,
    title: 'Sponsor a bracket',
    subtitle: 'Put your brand next to a themed VS WORLDCUP challenge.',
    cta: 'Start sponsor inquiry',
    source: 'home',
    disclaimer: 'No payments are collected here — this only opens an inquiry email.',
  };
}

export function buildSponsorMailto({ title = 'Sponsor a bracket', source = 'unknown' } = {}) {
  const subject = encodeURIComponent(title);
  const body = encodeURIComponent(`Hi — I want to learn about sponsoring a VS WORLDCUP bracket.\n\nsource: ${source}\n`);
  return `mailto:sponsors@vsworldcup.com?subject=${subject}&body=${body}`;
}
