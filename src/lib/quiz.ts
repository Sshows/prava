export type Question = { id: string; q: string; o: string[]; a: number; l: number; e: string; source: string };
export type Option = { key: number; text: string };
export type QuizItem = { q: Question; options: Option[]; retry?: boolean };

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


export type Category = "all" | "numbers" | "longest" | "other";
export function questionCategory(q: Question): Exclude<Category, "all"> {
  if (q.o.every(o => /\d/.test(o))) return "numbers";
  const lengths = q.o.map(o => o.trim().length);
  if (lengths.every((len, i) => i === q.a || lengths[q.a]! > len)) return "longest";
  return "other";
}
export function filterQuestions(qs: Question[], lectures: number[], category: Category) {
  return qs.filter(q => lectures.includes(q.l) && (category === "all" || questionCategory(q) === category));
}
export function scheduleRetry(items: QuizItem[], idx: number, pool: Question[], shuffleO: boolean): QuizItem[] {
  const current = items[idx]!;
  const upcoming = items.slice(idx + 1);
  const missing = Math.max(0, 2 - upcoming.length);
  const distractors = fisherYates(pool.filter(q => q.id !== current.q.id));
  const gaps: QuizItem[] = [];
  for (let i = 0; i < missing && distractors.length; i++) {
    const q = distractors[i % distractors.length]!;
    gaps.push(...buildQuiz([q], false, shuffleO, "all"));
  }
  const future = [...upcoming, ...gaps];
  const repeat = { ...buildQuiz([current.q], false, shuffleO, "all")[0]!, retry: true };
  future.splice(Math.min(2, future.length), 0, repeat);
  return [...items.slice(0, idx + 1), ...future];
}
