import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { requireAdminOrSuper } from "./middleware";
import { storage } from "../storage";

function makeRes() {
  const state = { code: 200, body: null as unknown };
  const res = {
    status(code: number) {
      state.code = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, state };
}

test("requireAdminOrSuper rejects moderator role", async () => {
  const original = storage.getUser;
  storage.getUser = (async () => ({ id: "u1", platformRole: "moderator" } as never)) as typeof storage.getUser;
  const req = { session: { userId: "u1" } } as unknown as Request;
  const { res, state } = makeRes();
  let nextCalled = false;
  await requireAdminOrSuper(req, res, () => {
    nextCalled = true;
  });
  storage.getUser = original;
  assert.equal(nextCalled, false);
  assert.equal(state.code, 403);
});

test("requireAdminOrSuper allows admin role", async () => {
  const original = storage.getUser;
  storage.getUser = (async () => ({ id: "u2", platformRole: "admin" } as never)) as typeof storage.getUser;
  const req = { session: { userId: "u2" } } as unknown as Request;
  const { res } = makeRes();
  let nextCalled = false;
  await requireAdminOrSuper(req, res, () => {
    nextCalled = true;
  });
  storage.getUser = original;
  assert.equal(nextCalled, true);
});
