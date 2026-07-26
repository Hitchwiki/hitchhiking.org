fetch('site-meta.json')
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((meta) => {
    const format = (value) => new Date(value).toISOString().slice(0, 16).replace('T', ' ');
    document.getElementById('page-date').textContent = format(meta.deployedAt);
    document.getElementById('commit-date').textContent = format(meta.commitAt);
  })
  .catch(() => {});
