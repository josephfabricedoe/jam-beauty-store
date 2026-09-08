/**
 * Utility to export JavaScript arrays of objects to a clean downloadable CSV file.
 */
export function downloadCSV(filename, rows, headers) {
  if (!rows || !rows.length) {
    alert('No data available to export.');
    return;
  }

  const headerKeys = headers ? Object.keys(headers) : Object.keys(rows[0]);
  const headerLabels = headers ? Object.values(headers) : headerKeys;

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [];
  csvRows.push(headerLabels.map(escapeCSV).join(','));

  for (const row of rows) {
    const values = headerKeys.map(k => {
      const val = row[k];
      return escapeCSV(val);
    });
    csvRows.push(values.join(','));
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
