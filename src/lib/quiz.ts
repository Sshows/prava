export type Question = { id: string; q: string; o: string[]; a: number; l: number; e: string; source: string };
export type Option = { key: number; text: string };
export type QuizItem = { q: Question; options: Option[] };

export const LECTURES: Record<number, string> = {
  1: "Теория права",
  2: "Конституция",
  3: "Гражданское право",
  4: "Трудовое право",
  5: "Семейное право",
  6: "Административное право",
};

export function fisherYates<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Options keep their original index as `key`, so correctness is checked by key === q.a after shuffling. */
export function buildQuiz(qs: Question[], shuffleQ: boolean, shuffleO: boolean, count: number | "all"): QuizItem[] {
  const ordered = shuffleQ ? fisherYates(qs) : qs.slice();
  const picked = count === "all" ? ordered : ordered.slice(0, count);
  return picked.map((q) => {
    const opts = q.o.map((text, key) => ({ key, text }));
    return { q, options: shuffleO ? fisherYates(opts) : opts };
  });
}

export function filterQuestions(qs: Question[], lectures: number[], source: "all" | "rk1" | "extra") {
  return qs.filter(
    (q) =>
      lectures.includes(q.l) &&
      (source === "all" || (source === "rk1" ? q.source === "РК1" : q.source !== "РК1")),
  );
}

