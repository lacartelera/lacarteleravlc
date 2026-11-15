export function displayName(value = '') {
  const text = value.replace(/\s+/g, ' ').trim().replace(/[.。…]+$/u, '').trim();
  const smallWords = new Set(['a','al','con','de','del','el','en','la','las','los','o','para','por','sin','un','una','unos','unas','y']);
  let index = 0;
  return text.toLocaleLowerCase('es').replace(/\p{L}[\p{L}\p{M}\d]*/gu, word => {
    const first = index++ === 0;
    if (/^(vose|abc)$/.test(word) || /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/.test(word)) return word.toUpperCase();
    return !first && smallWords.has(word) ? word : word.charAt(0).toLocaleUpperCase('es') + word.slice(1);
  });
}
