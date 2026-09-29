// "1 star" and "2 stars": counts in screen-reader labels.
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
