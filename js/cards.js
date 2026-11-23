// Cards.   Code: (c) Corey J Ruff
// A card is an integer 0..51:  rank = floor(c / 4) + 1  (1 = Ace .. 13 = King),  suit = c % 4

/** How many cards of the same rank as the last one sit at the end of the pile (e.g. 6-6-6 -> 3). */
export function sameRankTail(seq) {
  let n = 0;
  for (let i = seq.length - 1; i >= 0 && RANK[seq[i]] === RANK[seq[seq.length - 1]]; i--) n++;
  return n;
}
export const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];   // spade heart diamond club
export const RED_SUITS = [1, 2];
export const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const RANK = Array.from({ length: 52 }, (_, c) => Math.floor(c / 4) + 1);
export const SUIT = Array.from({ length: 52 }, (_, c) => c % 4);
export const VAL = RANK.map((r) => Math.min(r, 10));

export const cardName = (c) => RANK_NAMES[RANK[c]] + SUIT_SYMBOLS[SUIT[c]];
export const cardsText = (cards) => cards.map(cardName).join(" ");
export const sortCards = (cards) => [...cards].sort((a, b) => RANK[a] - RANK[b] || SUIT[a] - SUIT[b]);

export function newDeck(rng) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  rng.shuffle(deck);
  return deck;
}

// All r-element combinations, in the same order as Python's itertools.combinations.
export function combinations(arr, r) {
  const out = [];
  const n = arr.length;
  if (r > n) return out;
  const idx = Array.from({ length: r }, (_, i) => i);
  for (;;) {
    out.push(idx.map((i) => arr[i]));
    let i = r - 1;
    while (i >= 0 && idx[i] === i + n - r) i--;
    if (i < 0) return out;
    idx[i]++;
    for (let j = i + 1; j < r; j++) idx[j] = idx[j - 1] + 1;
  }
}

// Cartesian product, same order as Python's itertools.product.
export function product(lists) {
  let out = [[]];
  for (const lst of lists) {
    const next = [];
    for (const prefix of out) for (const x of lst) next.push([...prefix, x]);
    out = next;
  }
  return out;
}
