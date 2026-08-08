import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

describe('public release metadata', () => {
  it('ships the complete AGPL and scopes it to original software', () => {
    expect(read('LICENSE')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
    expect(read('README.md')).toContain('AGPL-3.0-or-later');
    expect(read('README.md')).toContain('(c) 2025–2026 guaka and till');
    expect(read('NOTICE.md')).toContain('The terms below take precedence');
  });

  it('keeps required human-facing attribution on the about page', () => {
    const about = read('about/index.html');
    expect(about).toContain('Roger McLassus');
    expect(about).toContain('CC BY-SA 3.0');
    expect(about).toContain('OpenStreetMap contributors');
    expect(about).toContain('Signal Technology Foundation');
  });

  it('documents that production deployment remains separate', () => {
    expect(read('README.md')).toContain('private operations');
    expect(read('README.md')).toContain('scripts/export-release.sh');
  });

  it('links every primary page to the public source beside its datetime', () => {
    for (const page of ['index.html', 'index_template.html', 'about/index.html', 'chat/index.html']) {
      const html = read(page);
      expect(html).toContain('https://github.com/Hitchwiki/hitchhiking.org');
      expect(html).toContain('aria-label="hitchhiking.org source on GitHub"');
      expect(html).toMatch(/<time[^>]*>[\s\S]*class="commit-link"/);
      expect(html).not.toContain('<span>source</span>');
      expect(html).not.toContain('updated <time');
      expect(html).toMatch(/class="header-nav"[\s\S]*href="\/about\/">About<\/a>/);
    }
  });

  it('runs least-privilege validation without deployment or secrets', () => {
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('actions/checkout@v6');
    expect(workflow).toContain('actions/setup-node@v6');
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm test');
    expect(workflow).toContain('scripts/export-release.sh');
    expect(workflow).not.toMatch(/contents:\s*write/);
    expect(workflow).not.toMatch(/\bsecrets\./);
    expect(workflow).not.toMatch(/deploy-pages|git push/);
  });
});
