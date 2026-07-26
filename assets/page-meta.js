const pageDate = document.getElementById('page-date');
const commitDate = document.getElementById('commit-date');

if (pageDate && commitDate) fetch('/site-meta.json')
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((meta) => {
    const format = (value) => new Date(value).toISOString().slice(0, 16).replace('T', ' ');
    pageDate.textContent = format(meta.deployedAt);
    commitDate.textContent = format(meta.commitAt);
  })
  .catch(() => {});
