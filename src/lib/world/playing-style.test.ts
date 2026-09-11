import { describe, it, expect } from "vitest";
import {
  normalizePlayingStyle,
  normalizeAiPlayingStyle,
  arePlayingStylesEquivalent,
  KNOWN_OFFENSIVE_PLAYING_STYLES,
  KNOWN_DEFENSIVE_PLAYING_STYLES,
  PLAYING_STYLE_ALIASES,
  PLAYING_STYLE_ANOMALY_VALUES,
  KNOWN_AI_PLAYING_STYLES,
  AI_PLAYING_STYLE_UNKNOWN_MARKERS,
} from "./playing-style";

describe("normalizePlayingStyle: 既知の正規表記", () => {
  it("攻撃プレースタイルの正規表記はstatus=knownで一致する", () => {
    const r = normalizePlayingStyle("Box-to-Box", "offensive", "world");
    expect(r.status).toBe("known");
    expect(r.canonicalId).toBe("boxToBox");
    expect(r.canonicalEnglishName).toBe("Box-to-Box");
    expect(r.rawValue).toBe("Box-to-Box");
    expect(r.attribute).toBe("offensive");
  });

  it("守備プレースタイルの正規表記はstatus=knownで一致する", () => {
    const r = normalizePlayingStyle("The Destroyer", "defensive", "world");
    expect(r.status).toBe("known");
    expect(r.canonicalId).toBe("theDestroyer");
  });

  it("全21種類の攻撃プレースタイルがstatus=knownになる", () => {
    for (const [id, name] of Object.entries(KNOWN_OFFENSIVE_PLAYING_STYLES)) {
      const r = normalizePlayingStyle(name, "offensive", "world");
      expect(r.status, `${name} should be known`).toBe(id === "basic" ? "basic" : "known");
    }
  });

  it("全14種類の守備プレースタイルがstatus=known（Basicのみ別扱い）になる", () => {
    for (const [id, name] of Object.entries(KNOWN_DEFENSIVE_PLAYING_STYLES)) {
      const r = normalizePlayingStyle(name, "defensive", "world");
      expect(r.status, `${name} should be recognized`).toBe(id === "basic" ? "basic" : "known");
    }
  });
});

describe("normalizePlayingStyle: 確認済みの表記揺れ（別名）", () => {
  it("Box To Box は Box-to-Box と同じcanonicalIdになる（表記揺れとして解決）", () => {
    const a = normalizePlayingStyle("Box To Box", "offensive", "efhub");
    const b = normalizePlayingStyle("Box-to-Box", "offensive", "world");
    expect(a.status).toBe("aliasMatched");
    expect(a.canonicalId).toBe(b.canonicalId);
    expect(arePlayingStylesEquivalent(a, b)).toBe(true);
  });

  it("Deep-Lying Forward は Deep-lying Forward と同じcanonicalIdになる", () => {
    const a = normalizePlayingStyle("Deep-Lying Forward", "offensive", "efhub");
    const b = normalizePlayingStyle("Deep-lying Forward", "offensive", "world");
    expect(a.canonicalId).toBe(b.canonicalId);
    expect(a.canonicalId).toBe("deepLyingForward");
  });

  it("Fox In The Box は Fox in the Box と同じcanonicalIdになる", () => {
    const a = normalizePlayingStyle("Fox In The Box", "offensive", "efhub");
    const b = normalizePlayingStyle("Fox in the Box", "offensive", "world");
    expect(a.canonicalId).toBe(b.canonicalId);
    expect(a.canonicalId).toBe("foxInTheBox");
  });

  it("Destroyer（eFHUBの攻撃欄の実値）は The Destroyer（Worldの守備欄専用）へ統合しない（属性をまたぐ推測を避ける）", () => {
    // eFHUBのplaying_style_nameは攻撃欄だが、値としては守備概念に見える"Destroyer"が実在する。
    // World側のThe Destroyerは守備欄専用のため、確認済みの根拠なく攻撃⇔守備をまたいで統合しない。
    const a = normalizePlayingStyle("Destroyer", "offensive", "efhub");
    expect(a.status).toBe("unknown");
    expect(a.canonicalId).toBeNull();
  });

  it("Defensive Goalkeeper（eFHUBの攻撃欄の実値）は Defensive GK（Worldの守備欄専用）へ統合しない", () => {
    const a = normalizePlayingStyle("Defensive Goalkeeper", "offensive", "efhub");
    expect(a.status).toBe("unknown");
    expect(a.canonicalId).toBeNull();
  });

  it("matchedAliasに一致した生表記を保持する", () => {
    const r = normalizePlayingStyle("Box To Box", "offensive", "efhub");
    expect(r.matchedAlias).toBe("Box To Box");
  });

  it("確認済みの3件の別名すべてを検証する（属性をまたぐ2件は意図的に含めない）", () => {
    for (const alias of PLAYING_STYLE_ALIASES) {
      const r = normalizePlayingStyle(alias.rawValue, alias.attribute, "efhub");
      expect(r.status).toBe("aliasMatched");
      expect(r.canonicalId).toBe(alias.canonicalId);
    }
  });
});

describe("normalizePlayingStyle: 攻撃と守備を混同しない", () => {
  it("同じ文字列でも攻撃属性と守備属性は別のattributeとして保持される", () => {
    const off = normalizePlayingStyle("Box-to-Box", "offensive", "world");
    const def = normalizePlayingStyle("Box-to-Box", "defensive", "world");
    expect(off.attribute).toBe("offensive");
    expect(def.attribute).toBe("defensive");
    expect(off.canonicalId).toBe(def.canonicalId); // 同じ名称なのでID自体は同じ
    // ただし arePlayingStylesEquivalent は attribute も見るため、混同判定はしない
  });

  it("守備専用の名称を攻撃属性で正規化すると notApplicable になる（統合しない）", () => {
    const r = normalizePlayingStyle("The Destroyer", "offensive", "world");
    expect(r.status).toBe("notApplicable");
    expect(r.canonicalId).toBe("theDestroyer");
  });

  it("攻撃専用の名称を守備属性で正規化すると notApplicable になる", () => {
    const r = normalizePlayingStyle("Fox in the Box", "defensive", "world");
    expect(r.status).toBe("notApplicable");
  });

  it("Basicは攻撃・守備どちらの属性でもstatus=basicになり、known(実スタイル)とは区別される", () => {
    const off = normalizePlayingStyle("Basic", "offensive", "world");
    const def = normalizePlayingStyle("Basic", "defensive", "world");
    expect(off.status).toBe("basic");
    expect(def.status).toBe("basic");
  });

  it("arePlayingStylesEquivalentは属性が異なる場合はfalseを返す", () => {
    const off = normalizePlayingStyle("Box-to-Box", "offensive", "world");
    const def = normalizePlayingStyle("Box-to-Box", "defensive", "world");
    expect(arePlayingStylesEquivalent(off, def)).toBe(false);
  });
});

describe("normalizePlayingStyle: 異常値・未知値・値なし", () => {
  it("$undefinedは異常値として扱い、正式なプレースタイルへ変換しない", () => {
    const r = normalizePlayingStyle("$undefined", "offensive", "efhub");
    expect(r.status).toBe("anomaly");
    expect(r.canonicalId).toBeNull();
    expect(PLAYING_STYLE_ANOMALY_VALUES.has("$undefined")).toBe(true);
  });

  it("未知の値を既知スタイルへ誤変換しない", () => {
    const r = normalizePlayingStyle("Offensive Wingback", "offensive", "efhub");
    expect(r.status).toBe("unknown");
    expect(r.canonicalId).toBeNull();
  });

  it("類似名称というだけでOffensive GoalkeeperをAttacking GKへ推測変換しない", () => {
    const r = normalizePlayingStyle("Offensive Goalkeeper", "offensive", "efhub");
    expect(r.status).toBe("unknown");
  });

  it("null/undefined/空文字はstatus=emptyとして区別される", () => {
    expect(normalizePlayingStyle(null, "offensive", "world").status).toBe("empty");
    expect(normalizePlayingStyle(undefined, "offensive", "world").status).toBe("empty");
    expect(normalizePlayingStyle("", "offensive", "world").status).toBe("empty");
    expect(normalizePlayingStyle("   ", "offensive", "world").status).toBe("empty");
  });

  it("Basicを推測で他の既知スタイルへ変換しない", () => {
    const r = normalizePlayingStyle("Basic", "offensive", "world");
    expect(r.status).toBe("basic");
    expect(r.canonicalId).toBe("basic");
    expect(r.canonicalId).not.toBe("holePlayer");
  });

  it("大文字小文字だけが異なる値を無制限に既知スタイルへ吸収しない（確認済み別名のみ許可）", () => {
    const r = normalizePlayingStyle("box-to-box", "offensive", "world");
    expect(r.status).toBe("unknown");
  });
});

describe("normalizePlayingStyle: 決定性・純粋性", () => {
  it("同一入力から常に同一結果を返す", () => {
    const a = normalizePlayingStyle("Box To Box", "offensive", "efhub");
    const b = normalizePlayingStyle("Box To Box", "offensive", "efhub");
    expect(a).toEqual(b);
  });

  it("rawValueを一切変更せず保持する（trimしない）", () => {
    const r = normalizePlayingStyle("  Box-to-Box  ", "offensive", "world");
    expect(r.rawValue).toBe("  Box-to-Box  ");
    expect(r.status).toBe("known");
  });

  it("内部識別子はcanonicalId以外の形でユーザー表示へ出さない設計（canonicalEnglishNameは既存表記そのもの）", () => {
    const r = normalizePlayingStyle("Box-to-Box", "offensive", "world");
    expect(r.canonicalEnglishName).toBe("Box-to-Box");
    expect(r.canonicalEnglishName).not.toBe(r.canonicalId);
  });
});

describe("normalizeAiPlayingStyle: 通常プレースタイルとの分離", () => {
  it("既知のAIプレースタイルはstatus=knownになる", () => {
    for (const name of KNOWN_AI_PLAYING_STYLES) {
      const r = normalizeAiPlayingStyle(name, "world");
      expect(r.status).toBe("known");
      expect(r.canonicalEnglishName).toBe(name);
    }
  });

  it("'-' は未知記号（unknownMarker）として扱い、異常値(anomaly)や通常の未知値とは区別する", () => {
    const r = normalizeAiPlayingStyle("-", "world");
    expect(r.status).toBe("unknownMarker");
    expect(AI_PLAYING_STYLE_UNKNOWN_MARKERS.has("-")).toBe(true);
  });

  it("通常プレースタイルの名称をAIプレースタイルとして渡しても既知として誤認しない", () => {
    const r = normalizeAiPlayingStyle("Box-to-Box", "world");
    expect(r.status).toBe("unknown");
  });

  it("AIプレースタイルの既知名を通常プレースタイルとして渡しても既知として誤認しない", () => {
    const r = normalizePlayingStyle("Speeding Bullet", "offensive", "world");
    expect(r.status).toBe("unknown");
  });

  it("null/空文字はstatus=emptyになる", () => {
    expect(normalizeAiPlayingStyle(null, "world").status).toBe("empty");
    expect(normalizeAiPlayingStyle("", "world").status).toBe("empty");
  });

  it("同一入力から常に同一結果を返す", () => {
    const a = normalizeAiPlayingStyle("Trickster", "world");
    const b = normalizeAiPlayingStyle("Trickster", "world");
    expect(a).toEqual(b);
  });
});

describe("台帳(docs/playing-style-ledger.md)との整合性", () => {
  it("攻撃プレースタイルは21種類", () => {
    expect(Object.keys(KNOWN_OFFENSIVE_PLAYING_STYLES)).toHaveLength(21);
  });
  it("守備プレースタイルは14種類（basic/boxToBox/anchorManの共有3件を含む）", () => {
    expect(Object.keys(KNOWN_DEFENSIVE_PLAYING_STYLES)).toHaveLength(14);
  });
  it("AIプレースタイルは7種類の既知値（'-'を除く）", () => {
    expect(KNOWN_AI_PLAYING_STYLES.size).toBe(7);
  });
  it("確認済み別名は3件（属性をまたぐ2件は意図的に未登録）", () => {
    expect(PLAYING_STYLE_ALIASES).toHaveLength(3);
  });
  it("英語表記の重複が無い（攻撃内・守備内でそれぞれ一意）", () => {
    const offNames = Object.values(KNOWN_OFFENSIVE_PLAYING_STYLES);
    expect(new Set(offNames).size).toBe(offNames.length);
    const defNames = Object.values(KNOWN_DEFENSIVE_PLAYING_STYLES);
    expect(new Set(defNames).size).toBe(defNames.length);
  });
});
