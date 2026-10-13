import test from "node:test";
import assert from "node:assert/strict";
import { resolveMotionPreference } from "../src/animations.js";

test("mặc định theo hệ thống, nhưng lựa chọn bật/tắt rõ ràng trong app được ưu tiên", () => {
  assert.equal(resolveMotionPreference(null, true), "reduced");
  assert.equal(resolveMotionPreference(null, false), "full");
  assert.equal(resolveMotionPreference("full", true), "full");
  assert.equal(resolveMotionPreference("reduced", false), "reduced");
  assert.equal(resolveMotionPreference("invalid", true), "reduced");
});
