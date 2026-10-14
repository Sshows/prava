import { useEffect, useMemo, useState } from "react";
import { LECTURES, buildQuiz, filterQuestions, scheduleRetry, type Question, type QuizItem } from "./lib/quiz";


type Mode = "train" | "exam";
type Source = "all" | "numbers" | "longest" | "other";
type Answer = { id: string; chosen: number };
type HistoryEntry = { date: number; mode: Mode; score: number; total: number; seconds: number };

const HKEY = "pravo-history";
const MKEY = "pravo-mistakes";
const load = <T,>(k: string, d: T): T => {
  try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; }
};
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function App() {
  const [all, setAll] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<"setup" | "quiz" | "result">("setup");
  const [lectures, setLectures] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [source, setSource] = useState<Source>("all");
  const [count, setCount] = useState<number | "all">("all");
  const [mode, setMode] = useState<Mode>("train");
  const [shQ, setShQ] = useState(true);
  const [shO, setShO] = useState(true);
  const [items, setItems] = useState<QuizItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mistakes, setMistakes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/questions.json").then((r) => { if (!r.ok) throw new Error("Не удалось загрузить вопросы"); return r.json(); }).then(setAll).catch(() => setError("Не удалось загрузить вопросы. Обновите страницу."));
    setHistory(load(HKEY, []));
    setMistakes(load<string[]>(MKEY, []).filter(id => id.startsWith("rk-")));
  }, []);

  useEffect(() => {
    if (screen !== "quiz") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [screen]);

  const pool = useMemo(() => filterQuestions(all, lectures, source), [all, lectures, source]);

  const start = (qs: Question[], m: Mode = mode) => {
    if (!qs.length) return;
    setMode(m);
    setItems(buildQuiz(qs, shQ, shO, qs === pool ? count : "all"));
    setIdx(0); setAnswers([]); setSeconds(0); setScreen("quiz");
    window.scrollTo(0, 0);
  };

  const finish = (ans: Answer[]) => {
    const score = ans.filter((a, i) => a.chosen === items[i]!.q.a).length;
    const entry: HistoryEntry = { date: Date.now(), mode, score, total: items.length, seconds };
    const h = [entry, ...history].slice(0, 30);
    setHistory(h);
    try {
      localStorage.setItem(HKEY, JSON.stringify(h));
    } catch { /* Quiz remains usable when storage is unavailable. */ }
    setScreen("result");
    window.scrollTo(0, 0);
  };

  const choose = (key: number) => {
    if (answers[idx]) return;
    const next = [...answers, { id: items[idx]!.q.id, chosen: key }];
    setAnswers(next);
    const wrong = new Set(mistakes);
    const good = key === items[idx]!.q.a;
    if (good) wrong.delete(items[idx]!.q.id); else wrong.add(items[idx]!.q.id);
    const remaining = [...wrong];
    setMistakes(remaining);
    try { localStorage.setItem(MKEY, JSON.stringify(remaining)); } catch {}
    if (!good && mode === "train") {
      setItems(scheduleRetry(items, idx, pool.length > 1 ? pool : all.filter(q => lectures.includes(q.l)), shO));
    }
    if (mode === "exam") {
      if (idx + 1 < items.length) setIdx(idx + 1);
      else finish(next);
    }
  };

  const next = () => (idx + 1 < items.length ? setIdx(idx + 1) : finish(answers));

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <button onClick={() => setScreen("setup")} className="font-display text-lg font-bold">
          Право <span className="rounded-md bg-accent px-1.5 text-accent-foreground">/</span> Практика
        </button>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">РК1 · Казахстан</span>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">
        {error && <p role="alert" className="card-soft p-6 text-destructive">{error}</p>}
        {!all.length && !error && <p role="status">Загружаем все 122 вопроса…</p>}
        {screen === "setup" && (
          <Setup {...{ all, pool, lectures, setLectures, source, setSource, count, setCount, mode, setMode, shQ, setShQ, shO, setShO, history, mistakes }}
            onStart={() => start(pool)}
            onMistakes={() => start(all.filter((q) => lectures.includes(q.l) && mistakes.includes(q.id)), "train")}
            onClear={() => { try { localStorage.removeItem(HKEY); localStorage.removeItem(MKEY); } catch {} setHistory([]); setMistakes([]); }} />
        )}
        {screen === "quiz" && items[idx] && (
          <Quiz item={items[idx]!} idx={idx} total={items.length} mode={mode} seconds={seconds}
            answer={answers[idx]} onChoose={choose} onNext={next} onExit={() => setScreen("setup")} />
        )}
        {screen === "result" && (
          <Result items={items} answers={answers} seconds={seconds} mode={mode}
            onRetryWrong={() => start(all.filter(q => mistakes.includes(q.id) && items.some(it => it.q.id === q.id)), "train")}
            onRestart={() => start(pool)} onHome={() => setScreen("setup")} />
        )}
      </main>
    </div>
  );
}

function Seg<T extends string | number>({ value, set, opts }: { value: T; set: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(([v, l]) => (
        <button key={String(v)} className="chip" data-on={value === v} aria-pressed={value === v} onClick={() => set(v)}>{l}</button>
      ))}
    </div>
  );
}

function Setup(p: {
  all: Question[]; pool: Question[]; lectures: number[]; setLectures: (v: number[]) => void;
  source: Source; setSource: (v: Source) => void; count: number | "all"; setCount: (v: number | "all") => void;
  mode: Mode; setMode: (v: Mode) => void; shQ: boolean; setShQ: (v: boolean) => void; shO: boolean; setShO: (v: boolean) => void;
  history: HistoryEntry[]; mistakes: string[]; onStart: () => void; onMistakes: () => void; onClear: () => void;
}) {
  const toggle = (l: number) => p.setLectures(p.lectures.includes(l) ? p.lectures.filter((x) => x !== l) : [...p.lectures, l].sort());
  const n = p.count === "all" ? p.pool.length : Math.min(p.count, p.pool.length);
  return (
    <div className="space-y-6">
      <section className="py-6">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Готовься к РК1 <br />на <span className="bg-accent px-2 text-accent-foreground">практике</span>
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">{p.all.length} вопросов по шести лекциям основ права Казахстана. Тренировка с повтором ошибок через два вопроса или экзамен с разбором.</p>
      </section>

      <section className="card-soft space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Лекции</h2>
          <button className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => p.setLectures(p.lectures.length === 6 ? [] : [1, 2, 3, 4, 5, 6])}>
            {p.lectures.length === 6 ? "Снять все" : "Выбрать все"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(LECTURES).map(([k, name]) => {
            const l = Number(k); const on = p.lectures.includes(l);
            const c = p.all.filter((q) => q.l === l).length;
            return (
              <button key={k} onClick={() => toggle(l)} data-on={on} aria-pressed={on}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-foreground data-[on=true]:border-foreground data-[on=true]:bg-secondary">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-sm font-bold data-[on=true]:bg-accent" data-on={on}>{l}</span>
                <span className="flex-1 font-semibold">{name}</span>
                <span className="text-xs text-muted-foreground">{c}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card-soft grid gap-5 p-6 sm:grid-cols-2">
        <div className="space-y-2"><h2 className="text-sm font-bold uppercase tracking-wider">Подборка вопросов</h2>
          <Seg value={p.source} set={p.setSource} opts={[["all", "Все РК1"], ["numbers", "Статьи и числа"], ["longest", "Длинный ответ"], ["other", "Остальные"]]} />
          <p className="text-xs text-muted-foreground">Статьи и числа — ответы с номерами, датами и сроками. Длинный ответ — правильный вариант длиннее остальных. Подборки не пересекаются.</p></div>
        <div className="space-y-2"><h2 className="text-sm font-bold uppercase tracking-wider">Количество</h2>
          <Seg value={p.count} set={p.setCount} opts={[[10, "10"], [20, "20"], [30, "30"], ["all", "Все"]]} /></div>
        <div className="space-y-2"><h2 className="text-sm font-bold uppercase tracking-wider">Режим</h2>
          <Seg value={p.mode} set={p.setMode} opts={[["train", "Тренировка"], ["exam", "Экзамен"]]} /></div>
        <div className="space-y-2"><h2 className="text-sm font-bold uppercase tracking-wider">Перемешивание</h2>
          <div className="flex flex-wrap gap-2">
            <button className="chip" data-on={p.shQ} aria-pressed={p.shQ} onClick={() => p.setShQ(!p.shQ)}>Вопросы</button>
            <button className="chip" data-on={p.shO} aria-pressed={p.shO} onClick={() => p.setShO(!p.shO)}>Варианты</button>
          </div></div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button disabled={!n} onClick={p.onStart}
          className="flex-1 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-40">
          Начать · {n} {p.mode === "exam" ? "экзамен" : "тренировка"}
        </button>
        {(
          <button disabled={!p.all.some(q => p.lectures.includes(q.l) && p.mistakes.includes(q.id))} onClick={p.onMistakes} className="rounded-2xl bg-accent px-6 py-4 font-bold text-accent-foreground transition hover:-translate-y-0.5 disabled:opacity-40">
            Работа над ошибками · {p.all.filter(q => p.lectures.includes(q.l) && p.mistakes.includes(q.id)).length}
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">В тренировке ошибочный вопрос вернётся после двух других. Ошибки сохраняются сразу, даже если выйти до конца. В работе над ошибками тренируешься до правильного ответа.</p>
      {p.history.length > 0 && (
        <section className="card-soft p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider">История</h2>
            <button onClick={p.onClear} className="text-sm font-semibold text-muted-foreground hover:text-destructive">Очистить</button>
          </div>
          <ul className="divide-y divide-border">
            {p.history.slice(0, 10).map((h) => (
              <li key={h.date} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{new Date(h.date).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })} · {h.mode === "exam" ? "Экзамен" : "Тренировка"}</span>
                <span className="font-bold">{h.score}/{h.total} <span className="font-normal text-muted-foreground">· {fmt(h.seconds)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Quiz({ item, idx, total, mode, seconds, answer, onChoose, onNext, onExit }: {
  item: QuizItem; idx: number; total: number; mode: Mode; seconds: number; answer: Answer | undefined;
  onChoose: (k: number) => void; onNext: () => void; onExit: () => void;
}) {
  const shown = mode === "train" && !!answer;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm font-semibold">
        <button onClick={onExit} className="text-muted-foreground hover:text-foreground">← Выйти</button>
        <span>{idx + 1} / {total}</span>
        <span className="rounded-full bg-secondary px-3 py-1 font-mono">{fmt(seconds)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((idx + (answer ? 1 : 0)) / total) * 100}%` }} />
      </div>
      <div className="card-soft p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
          <span className="rounded-full bg-secondary px-2.5 py-1">{LECTURES[item.q.l]}</span>
          <span className="rounded-full bg-secondary px-2.5 py-1">{item.retry ? "Повтор ошибки — попробуй снова" : item.q.source}</span>
        </div>
        <h2 className="font-sans text-xl font-bold leading-snug sm:text-2xl">{item.q.q}</h2>
        <div className="mt-6 space-y-2.5">
          {item.options.map((o, i) => {
            const correct = o.key === item.q.a, chosen = answer?.chosen === o.key;
            const st = shown ? (correct ? "ok" : chosen ? "bad" : "dim") : "idle";
            return (
              <button key={o.key} onClick={() => onChoose(o.key)} disabled={!!answer} data-st={st}
                className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left font-medium transition enabled:hover:border-foreground data-[st=ok]:border-success data-[st=ok]:bg-success data-[st=bad]:border-destructive data-[st=bad]:bg-destructive-soft data-[st=dim]:opacity-50">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold">{"АБВГДЕ"[i]}</span>
                <span className="pt-0.5">{o.text}</span>
              </button>
            );
          })}
        </div>
        {shown && (
          <div className="mt-5 rounded-2xl bg-secondary p-4 text-sm">
            <p className="font-bold">{answer!.chosen === item.q.a ? "Верно!" : `Неверно. Правильно: ${item.q.o[item.q.a]}`}</p>
            {item.q.e && <p className="mt-1 text-muted-foreground">{item.q.e}</p>}
            {answer!.chosen !== item.q.a && <p className="mt-2">Этот вопрос вернётся после двух других.</p>}
          </div>
        )}
      </div>
      {shown && (
        <button onClick={onNext} className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground">
          {idx + 1 < total ? "Дальше →" : "Результаты"}
        </button>
      )}
    </div>
  );
}

function Result({ items, answers, seconds, mode, onRetryWrong, onRestart, onHome }: {
  items: QuizItem[]; answers: Answer[]; seconds: number; mode: Mode; onRetryWrong: () => void; onRestart: () => void; onHome: () => void;
}) {
  const score = answers.filter((a, i) => a.chosen === items[i]!.q.a).length;
  const wrong = new Set(items.filter(it => [...answers].reverse().find(a => a.id === it.q.id)?.chosen !== it.q.a).map(it => it.q.id)).size;
  const pct = Math.round((score / items.length) * 100);
  return (
    <div className="space-y-6">
      <section className="card-soft p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{mode === "exam" ? "Экзамен завершён" : "Тренировка завершена"}</p>
        <p className="mt-3 font-display text-6xl font-bold">{pct}<span className="text-3xl">%</span></p>
        <p className="mt-2 text-muted-foreground">{score} из {items.length} верно · время {fmt(seconds)}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {wrong > 0 && <button onClick={onRetryWrong} className="rounded-2xl bg-accent px-5 py-3 font-bold text-accent-foreground">Повторить ошибки · {wrong}</button>}
          <button onClick={onRestart} className="rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground">Ещё раз</button>
          <button onClick={onHome} className="rounded-2xl border border-border px-5 py-3 font-bold">Настройки</button>
        </div>
      </section>
      <h2 className="text-xl font-bold">Разбор</h2>
      <ol className="space-y-3">
        {items.map((it, i) => {
          const ch = answers[i]?.chosen, ok = ch === it.q.a;
          return (
            <li key={`${it.q.id}-${i}`} className="card-soft p-5">
              <p className="font-bold"><span className={ok ? "rounded bg-success px-1.5" : "rounded bg-destructive-soft px-1.5"}>{i + 1}</span> {it.q.q}</p>
              {!ok && <p className="mt-2 text-sm"><span className="text-muted-foreground">Ваш ответ: </span><span className="text-destructive line-through">{ch !== undefined ? it.q.o[ch] : "—"}</span></p>}
              <p className="mt-1 text-sm"><span className="text-muted-foreground">Правильно: </span><b>{it.q.o[it.q.a]}</b></p>
              {it.q.e && <p className="mt-2 text-sm text-muted-foreground">{it.q.e}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

