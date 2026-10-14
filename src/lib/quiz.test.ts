import { describe, it, expect } from "vitest";
import { buildQuiz, filterQuestions, type Question } from "./quiz";
import data from "../../public/questions.json";

const qs = data as Question[];

describe("quiz", () => {
  it("has all 154 questions", () => expect(qs.length).toBe(154));
  it("keeps correct answer after shuffling", () => {
    const items = buildQuiz(qs, true, true, "all");
    for (const it of items) {
      const correct = it.options.find((o) => o.key === it.q.a)!;
      expect(correct.text).toBe(it.q.o[it.q.a]);
    }
  });
  it("filters by source", () => {
    const all = [1, 2, 3, 4, 5, 6];
    expect(filterQuestions(qs, all, "rk1").length).toBe(122);
    expect(filterQuestions(qs, all, "extra").length).toBe(32);
  });
});
