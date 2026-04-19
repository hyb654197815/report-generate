import { replacePlaceholdersInHtml } from './placeholder-replace';

describe('replacePlaceholdersInHtml', () => {
  it('replaces keys while keeping tags', () => {
    const html = '<p><strong>{{title}}</strong> {{body}}</p>';
    const out = replacePlaceholdersInHtml(html, {
      title: 'T',
      body: 'B',
    });
    expect(out).toContain('<strong>T</strong>');
    expect(out).toContain(' B</p>');
  });
});
