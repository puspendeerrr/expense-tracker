import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { api, resetAll, closeDatabase, signupUser } from "./helpers.js";
import { db } from "../src/db/client.js";
import { groups, groupMembers } from "../src/db/schema.js";
import { createExpense } from "../src/services/expenseService.js";
import * as geminiClient from "../src/services/geminiClient.js";

describe("SplitMoney AI Assistant API (/api/ai/chat)", () => {
  beforeEach(async () => {
    await resetAll();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("rejects unauthenticated requests with 401 UNAUTHENTICATED", async () => {
    const res = await api()
      .post("/api/ai/chat")
      .send({ message: "How much do I owe?" });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects empty or whitespace-only messages with 400 VALIDATION_ERROR", async () => {
    const { cookie } = await signupUser("user1@example.com");

    const res = await api()
      .post("/api/ai/chat")
      .set("Cookie", cookie)
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects messages exceeding 2000 characters with 400 VALIDATION_ERROR", async () => {
    const { cookie } = await signupUser("user2@example.com");
    const oversizedMessage = "a".repeat(2001);

    const res = await api()
      .post("/api/ai/chat")
      .set("Cookie", cookie)
      .send({ message: oversizedMessage });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects conversation history exceeding 10 items with 400 VALIDATION_ERROR", async () => {
    const { cookie } = await signupUser("user3@example.com");
    const oversizedHistory = Array.from({ length: 11 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));

    const res = await api()
      .post("/api/ai/chat")
      .set("Cookie", cookie)
      .send({ message: "Hello", history: oversizedHistory });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("successfully answers user query with structured response shape", async () => {
    const { cookie } = await signupUser("user4@example.com");

    vi.spyOn(geminiClient, "callGemini").mockResolvedValue({
      text: "You currently have no outstanding debts across your groups.",
      tokensUsed: 35,
    });

    const res = await api()
      .post("/api/ai/chat")
      .set("Cookie", cookie)
      .send({ message: "How much do I owe?" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(typeof data.answer).toBe("string");
    expect(data.answer).toBe(
      "You currently have no outstanding debts across your groups.",
    );
    expect(Array.isArray(data.sources)).toBe(true);
    expect(data.intent).toBe("balance");
    expect(data.language).toBe("en");
    expect(typeof data.metadata.latencyMs).toBe("number");
  });

  it("detects Hinglish queries and returns Hinglish language tag", async () => {
    const { cookie } = await signupUser("user5@example.com");

    vi.spyOn(geminiClient, "callGemini").mockResolvedValue({
      text: "Aapko Rahul ko koi paisa nahi dena hai.",
      tokensUsed: 28,
    });

    const res = await api()
      .post("/api/ai/chat")
      .set("Cookie", cookie)
      .send({ message: "Rahul ko mujhe kitna dena hai?" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.language).toBe("hinglish");
    expect(res.body.data.intent).toBe("balance");
    expect(res.body.data.answer).toBe(
      "Aapko Rahul ko koi paisa nahi dena hai.",
    );
  });

  it("scopes data retrieval to user groups and respects financial integrity", async () => {
    const userA = await signupUser(
      "usera@example.com",
      undefined,
      "User Alpha",
    );
    const userB = await signupUser("userb@example.com", undefined, "User Beta");

    // Create a group and add both users
    const [group] = await db
      .insert(groups)
      .values({
        name: "Apartment 301",
        inviteCode: "APT301",
        inviteToken: "apt301-token-12345678901234567890",
        createdBy: userA.userId,
      })
      .returning();

    await db.insert(groupMembers).values([
      { groupId: group!.id, userId: userA.userId, role: "creator" },
      { groupId: group!.id, userId: userB.userId, role: "member" },
    ]);

    // Add an expense via domain service: User B paid ₹1000, split equally across everyone (₹500 each)
    await createExpense({
      groupId: group!.id,
      actorUserId: userB.userId,
      title: "Electricity Bill",
      amountPaise: 100000,
      paidBy: userB.userId,
      paymentMode: "cash",
      splitType: "everyone",
      expenseDate: "2026-09-15",
    });

    // Mock Gemini verifying that the prompt contained the authoritative balance
    const callGeminiSpy = vi
      .spyOn(geminiClient, "callGemini")
      .mockImplementation(async (input) => {
        expect(input.systemInstruction).toContain("₹500.00");
        expect(input.systemInstruction).toContain("Apartment 301");
        return {
          text: "You owe User Beta ₹500.00 for the Electricity Bill in Apartment 301.",
          tokensUsed: 45,
        };
      });

    // User A asks "How much do I owe?"
    const resA = await api()
      .post("/api/ai/chat")
      .set("Cookie", userA.cookie)
      .send({ message: "How much do I owe?" });

    expect(resA.status).toBe(200);
    const data = resA.body.data;
    expect(callGeminiSpy).toHaveBeenCalled();
    expect(data.answer).toMatch(/500/);
    expect(
      data.sources.some(
        (s: { type: string }) => s.type === "member" || s.type === "group",
      ),
    ).toBe(true);
  });

  it("gracefully falls back to verified PostgreSQL data synthesis if Gemini call fails", async () => {
    const userA = await signupUser(
      "fallbackuser@example.com",
      undefined,
      "Fallback User",
    );

    // Simulate Gemini API outage
    vi.spyOn(geminiClient, "callGemini").mockRejectedValue(
      new Error("503 Service Unavailable"),
    );

    const res = await api()
      .post("/api/ai/chat")
      .set("Cookie", userA.cookie)
      .send({ message: "How much do I owe?" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.answer).toBeDefined();
    expect(typeof res.body.data.answer).toBe("string");
    expect(res.body.data.intent).toBe("balance");
  });

  it("enforces 20 requests per 15 minutes rate limit per user", async () => {
    const { cookie } = await signupUser("ratelimit@example.com");

    vi.spyOn(geminiClient, "callGemini").mockResolvedValue({
      text: "Quick response",
      tokensUsed: 10,
    });

    // Make 20 allowed requests
    for (let i = 0; i < 20; i++) {
      const res = await api()
        .post("/api/ai/chat")
        .set("Cookie", cookie)
        .send({ message: `Question ${i + 1}` });
      expect(res.status).toBe(200);
    }

    // 21st request should trigger 429
    const limitedRes = await api()
      .post("/api/ai/chat")
      .set("Cookie", cookie)
      .send({ message: "Question 21" });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.ok).toBe(false);
    expect(limitedRes.body.error.code).toBe("RATE_LIMITED");
  });
});
