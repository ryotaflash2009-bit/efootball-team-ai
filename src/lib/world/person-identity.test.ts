import { describe, expect, it } from "vitest";
import { duplicatePersons, isSamePerson, personKeyOf } from "./person-identity";

// 実データの例（World のカード ID）。同じ人物の別のカード・同名の別人。
const BUONGIORNO = ["105869601784218", "105782628696474", "105750148006298", "52848230515098"];
const COSTACURTA = ["88036360587367", "88032334055527", "88029918136423"];

describe("同じ選手の判定（カード ID の下位 20 ビット）", () => {
  it("同じ人物の別のカード（種類・時期が違う）は同じ選手", () => {
    for (const set of [BUONGIORNO, COSTACURTA]) for (const id of set) expect(isSamePerson(set[0], id)).toBe(true);
  });
  it("別の人物は別（名前に依存しない）", () => {
    expect(isSamePerson(BUONGIORNO[0], COSTACURTA[0])).toBe(false);
  });
  it("不正な ID は判定しない（null）・同じ ID は同じ選手", () => {
    expect(personKeyOf("abc")).toBeNull();
    expect(personKeyOf(null)).toBeNull();
    expect(personKeyOf("123".repeat(10))).toBeNull();
    expect(isSamePerson("abc", "abc")).toBe(false);
    expect(isSamePerson("89136409091415", "89136409091415")).toBe(true);
  });
  it("重複の組を返す（3 枚以上も 1 組）", () => {
    expect(duplicatePersons([BUONGIORNO[0], COSTACURTA[0], BUONGIORNO[1], null, BUONGIORNO[2]])).toEqual([{ personKey: personKeyOf(BUONGIORNO[0]), worldCardIds: [BUONGIORNO[0], BUONGIORNO[1], BUONGIORNO[2]] }]);
    expect(duplicatePersons([BUONGIORNO[0], COSTACURTA[0]])).toEqual([]);
  });
});
