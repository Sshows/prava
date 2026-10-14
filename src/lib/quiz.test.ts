import { describe, it, expect } from "vitest";
import { buildQuiz, filterQuestions, questionCategory, scheduleRetry, type Question } from "./quiz";
import data from "../../public/questions.json";
const qs = data as Question[];
const lectures = [1,2,3,4,5,6];
describe("quiz", () => {
  it("keeps all 122 RK1 questions and removes extras", () => {
    expect(qs).toHaveLength(122);
    expect(new Set(qs.map(q=>q.id)).size).toBe(122);
    expect(qs.every(q=>q.source === "РК1")).toBe(true);
  });
  it("preserves answer keys after shuffling", () => {
    for (const item of buildQuiz(qs,true,true,"all")) expect(item.options.find(o=>o.key === item.q.a)?.text).toBe(item.q.o[item.q.a]);
  });
  it("partitions the bank without losing or duplicating questions", () => {
    const grouped = ["numbers","longest","other"] as const;
    const ids=grouped.flatMap(c=>filterQuestions(qs,lectures,c).map(q=>q.id));
    expect(ids.length).toBe(122); expect(new Set(ids).size).toBe(122);
    const employer=qs.find(q=>q.q === "Какая статья закрепляет основные права и обязанности работодателя?")!;
    expect(questionCategory(employer)).toBe("numbers");
    expect(employer.o[employer.a]).toBe("23");
    for (const q of filterQuestions(qs,lectures,"longest")) expect(q.o.every((o,i)=>i===q.a||q.o[q.a]!.length>o.length)).toBe(true);
  });
  it("retries a mistake only after two intervening questions", () => {
    const original=buildQuiz(qs.slice(0,5),false,false,"all");
    const updated=scheduleRetry(original,0,qs,true);
    expect(updated[1]!.q.id).toBe(original[1]!.q.id);
    expect(updated[2]!.q.id).toBe(original[2]!.q.id);
    expect(updated[3]!.q.id).toBe(original[0]!.q.id);
    expect(updated[3]!.retry).toBe(true);
    expect(original).toHaveLength(5);
  });
  it("adds two different intervening questions for a mistake at the end", () => {
    const original=buildQuiz(qs.slice(0,1),false,false,"all");
    const updated=scheduleRetry(original,0,qs,true);
    expect(updated).toHaveLength(4);
    expect(updated[1]!.q.id).not.toBe(original[0]!.q.id);
    expect(updated[2]!.q.id).not.toBe(original[0]!.q.id);
    expect(updated[3]!.q.id).toBe(original[0]!.q.id);
  });
});
