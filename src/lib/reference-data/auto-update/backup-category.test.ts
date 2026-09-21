import { describe, it, expect } from "vitest";
import { BACKUP_CATEGORIES, BACKUP_CATEGORY_MAPPING, resolveBackupCategory } from "./backup-category";

describe("BACKUP_CATEGORY_MAPPING(category→prefix/retentionCategory/retentionDaysの固定mapping)", () => {
  it("daily mapping: prefix=daily/, retentionCategory=production-daily, retentionDays=8(R2 Lifecycle Ruleと一致)", () => {
    expect(BACKUP_CATEGORY_MAPPING.daily).toEqual({ prefix: "daily/", retentionCategory: "production-daily", retentionDays: 8 });
  });

  it("weekly mapping: prefix=weekly/, retentionCategory=production-weekly, retentionDays=35(R2 Lifecycle Ruleと一致)", () => {
    expect(BACKUP_CATEGORY_MAPPING.weekly).toEqual({ prefix: "weekly/", retentionCategory: "production-weekly", retentionDays: 35 });
  });

  it("monthly mapping: prefix=monthly/, retentionCategory=production-monthly, retentionDays=100(R2 Lifecycle Ruleと一致)", () => {
    expect(BACKUP_CATEGORY_MAPPING.monthly).toEqual({ prefix: "monthly/", retentionCategory: "production-monthly", retentionDays: 100 });
  });

  it("pre-apply mapping: prefix=pre-apply/, retentionCategory=production-pre-apply, retentionDays=null(自動削除対象外)", () => {
    expect(BACKUP_CATEGORY_MAPPING["pre-apply"]).toEqual({ prefix: "pre-apply/", retentionCategory: "production-pre-apply", retentionDays: null });
  });

  it("retentionDaysは0や遠い未来の日付で偽装されていない(pre-applyだけがnull、他は正の整数)", () => {
    for (const category of BACKUP_CATEGORIES) {
      const days = BACKUP_CATEGORY_MAPPING[category].retentionDays;
      if (category === "pre-apply") {
        expect(days).toBeNull();
      } else {
        expect(typeof days).toBe("number");
        expect(days as number).toBeGreaterThan(0);
      }
    }
  });
});

describe("resolveBackupCategory(exact match、allowlist外・empty・case・whitespaceの拒否)", () => {
  it("daily/weekly/monthly/pre-applyはすべて成功する", () => {
    for (const c of BACKUP_CATEGORIES) {
      const result = resolveBackupCategory(c);
      expect(result.ok).toBe(true);
      expect(result.category).toBe(c);
      expect(result.mapping).toEqual(BACKUP_CATEGORY_MAPPING[c]);
    }
  });

  it("未知のcategoryは拒否する", () => {
    for (const bad of ["yearly", "production-standard", "hourly", "backup"]) {
      const result = resolveBackupCategory(bad);
      expect(result.ok).toBe(false);
      expect(result.mapping).toBeUndefined();
    }
  });

  it("空文字は拒否する", () => {
    expect(resolveBackupCategory("").ok).toBe(false);
  });

  it("大文字小文字違い(PRE-APPLY等)は暗黙補正せず拒否する", () => {
    expect(resolveBackupCategory("PRE-APPLY").ok).toBe(false);
    expect(resolveBackupCategory("Pre-Apply").ok).toBe(false);
    expect(resolveBackupCategory("DAILY").ok).toBe(false);
  });

  it("前後の空白は暗黙補正せず拒否する", () => {
    expect(resolveBackupCategory(" daily").ok).toBe(false);
    expect(resolveBackupCategory("daily ").ok).toBe(false);
    expect(resolveBackupCategory("\tpre-apply\n").ok).toBe(false);
  });

  it("prefix文字列そのもの(daily/等、末尾スラッシュ付き)は拒否する(categoryとprefixを混同させない)", () => {
    expect(resolveBackupCategory("daily/").ok).toBe(false);
    expect(resolveBackupCategory("pre-apply/").ok).toBe(false);
  });

  it("path traversal文字列・任意のretentionCategory文字列の注入も拒否する", () => {
    expect(resolveBackupCategory("../etc/passwd").ok).toBe(false);
    expect(resolveBackupCategory("production-standard").ok).toBe(false);
  });
});
