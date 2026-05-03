function detectCross(
  a: number[],
  b: number[],
  isCross: (curA: number, curB: number, prevA: number, prevB: number) => boolean,
): boolean[] {
  if (a.length !== b.length) {
    throw new TypeError('crossover/crossunder: input arrays must be the same length');
  }
  const out = new Array<boolean>(a.length).fill(false);
  for (let i = 1; i < a.length; i++) {
    const curA = a[i];
    const curB = b[i];
    const prevA = a[i - 1];
    const prevB = b[i - 1];
    if (
      !Number.isFinite(curA) || !Number.isFinite(curB) ||
      !Number.isFinite(prevA) || !Number.isFinite(prevB)
    ) {
      continue;
    }
    if (isCross(curA, curB, prevA, prevB)) out[i] = true;
  }
  return out;
}

export function crossover(a: number[], b: number[]): boolean[] {
  return detectCross(a, b, (curA, curB, prevA, prevB) => curA > curB && prevA <= prevB);
}

export function crossunder(a: number[], b: number[]): boolean[] {
  return detectCross(a, b, (curA, curB, prevA, prevB) => curA < curB && prevA >= prevB);
}
