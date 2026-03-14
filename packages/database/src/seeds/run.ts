import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createHash } from "crypto";
import * as schema from "../schema.js";

// Simple bcrypt-like hash for seeds (use bcrypt in production)
function hashPassword(password: string): string {
  return "$2b$12$" + createHash("sha256").update(password).digest("hex");
}

async function seed() {
  const connectionString =
    process.env["DATABASE_URL"] ??
    "postgresql://codepad:codepad@localhost:5432/codepad";

  console.log("Seeding database...");
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  // ─── Organizations ────────────────────────────────────────
  console.log("  Creating organizations...");
  const [acmeCorp, startupInc] = await db
    .insert(schema.organizations)
    .values([
      {
        name: "Acme Corporation",
        slug: "acme-corp",
        plan: "enterprise",
        maxSeats: 50,
        settings: { allowCustomBranding: true, ssoEnabled: true },
      },
      {
        name: "Startup Inc",
        slug: "startup-inc",
        plan: "team",
        maxSeats: 10,
        settings: {},
      },
    ])
    .returning()
    .onConflictDoNothing();

  const acmeId = acmeCorp?.id;
  const startupId = startupInc?.id;

  // ─── Users ────────────────────────────────────────────────
  console.log("  Creating users...");
  const [admin, alice, bob, charlie, diana, eve] = await db
    .insert(schema.users)
    .values([
      {
        email: "admin@codepad.io",
        name: "Admin User",
        passwordHash: hashPassword("admin123"),
        role: "admin",
        orgId: acmeId,
        avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=AU",
      },
      {
        email: "alice@acme.com",
        name: "Alice Chen",
        passwordHash: hashPassword("password123"),
        role: "member",
        orgId: acmeId,
        avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=AC",
      },
      {
        email: "bob@acme.com",
        name: "Bob Martinez",
        passwordHash: hashPassword("password123"),
        role: "member",
        orgId: acmeId,
        avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=BM",
      },
      {
        email: "charlie@startup.com",
        name: "Charlie Kim",
        passwordHash: hashPassword("password123"),
        role: "member",
        orgId: startupId,
        avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=CK",
      },
      {
        email: "diana@startup.com",
        name: "Diana Patel",
        passwordHash: hashPassword("password123"),
        role: "member",
        orgId: startupId,
        avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=DP",
      },
      {
        email: "eve@example.com",
        name: "Eve Candidate",
        passwordHash: hashPassword("password123"),
        role: "viewer",
        avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=EC",
      },
    ])
    .returning()
    .onConflictDoNothing();

  // ─── Sessions ─────────────────────────────────────────────
  console.log("  Creating sessions...");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [pairSession, interviewSession, teachingSession, sandboxSession] = await db
    .insert(schema.sessions)
    .values([
      {
        code: "PAR123",
        title: "Algorithm Practice - Two Sum",
        language: "python",
        type: "pair_programming",
        status: "active",
        ownerId: alice!.id,
        settings: {
          maxParticipants: 4,
          allowExecution: true,
          allowNetworkAccess: false,
          timeoutMinutes: 120,
          isPasswordProtected: false,
          recordingEnabled: false,
        },
        expiresAt,
      },
      {
        code: "INT456",
        title: "Senior Engineer Interview - System Design",
        language: "javascript",
        type: "interview",
        status: "active",
        ownerId: bob!.id,
        settings: {
          maxParticipants: 3,
          allowExecution: true,
          allowNetworkAccess: false,
          timeoutMinutes: 90,
          isPasswordProtected: true,
          recordingEnabled: true,
        },
        expiresAt,
      },
      {
        code: "TCH789",
        title: "Go Concurrency Workshop",
        language: "go",
        type: "teaching",
        status: "created",
        ownerId: charlie!.id,
        settings: {
          maxParticipants: 20,
          allowExecution: true,
          allowNetworkAccess: false,
          timeoutMinutes: 180,
          isPasswordProtected: false,
          recordingEnabled: true,
        },
        expiresAt,
      },
      {
        code: "SBX000",
        title: "Rust Playground",
        language: "rust",
        type: "sandbox",
        status: "active",
        ownerId: diana!.id,
        settings: {
          maxParticipants: 10,
          allowExecution: true,
          allowNetworkAccess: false,
          timeoutMinutes: 60,
          isPasswordProtected: false,
          recordingEnabled: false,
        },
        expiresAt,
      },
    ])
    .returning();

  // ─── Session Participants ─────────────────────────────────
  console.log("  Adding participants...");
  await db.insert(schema.sessionParticipants).values([
    { sessionId: pairSession!.id, userId: alice!.id, role: "owner", color: "#FF6B6B" },
    { sessionId: pairSession!.id, userId: bob!.id, role: "editor", color: "#4ECDC4" },
    { sessionId: interviewSession!.id, userId: bob!.id, role: "owner", color: "#FF6B6B" },
    { sessionId: interviewSession!.id, userId: alice!.id, role: "interviewer", color: "#4ECDC4" },
    { sessionId: interviewSession!.id, userId: eve!.id, role: "editor", color: "#45B7D1" },
    { sessionId: teachingSession!.id, userId: charlie!.id, role: "owner", color: "#FF6B6B" },
    { sessionId: sandboxSession!.id, userId: diana!.id, role: "owner", color: "#FF6B6B" },
  ]);

  // ─── Session Files ────────────────────────────────────────
  console.log("  Creating session files...");
  await db.insert(schema.sessionFiles).values([
    // Pair programming session
    {
      sessionId: pairSession!.id,
      path: "main.py",
      isEntryPoint: true,
      content: `# Two Sum Problem
# Given an array of integers nums and an integer target,
# return indices of the two numbers that add up to target.

def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Test cases
print(two_sum([2, 7, 11, 15], 9))   # Expected: [0, 1]
print(two_sum([3, 2, 4], 6))         # Expected: [1, 2]
print(two_sum([3, 3], 6))            # Expected: [0, 1]
`,
    },
    {
      sessionId: pairSession!.id,
      path: "test_solution.py",
      isEntryPoint: false,
      content: `import unittest
from main import two_sum

class TestTwoSum(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(two_sum([2, 7, 11, 15], 9), [0, 1])

    def test_middle(self):
        self.assertEqual(two_sum([3, 2, 4], 6), [1, 2])

    def test_same_elements(self):
        self.assertEqual(two_sum([3, 3], 6), [0, 1])

    def test_negative(self):
        self.assertEqual(two_sum([-1, -2, -3, -4, -5], -8), [2, 4])

if __name__ == "__main__":
    unittest.main()
`,
    },
    // Interview session
    {
      sessionId: interviewSession!.id,
      path: "index.js",
      isEntryPoint: true,
      content: `// Design a rate limiter using the sliding window algorithm
// Requirements:
// - Allow N requests per window of T seconds
// - Return true if request is allowed, false otherwise

class RateLimiter {
  constructor(maxRequests, windowSizeMs) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeMs;
    this.requests = new Map(); // userId -> timestamps[]
  }

  allowRequest(userId) {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;

    if (!this.requests.has(userId)) {
      this.requests.set(userId, []);
    }

    const userRequests = this.requests.get(userId);

    // Remove expired timestamps
    while (userRequests.length > 0 && userRequests[0] < windowStart) {
      userRequests.shift();
    }

    if (userRequests.length >= this.maxRequests) {
      return false;
    }

    userRequests.push(now);
    return true;
  }
}

// Test
const limiter = new RateLimiter(3, 1000); // 3 requests per second
console.log(limiter.allowRequest("user1")); // true
console.log(limiter.allowRequest("user1")); // true
console.log(limiter.allowRequest("user1")); // true
console.log(limiter.allowRequest("user1")); // false (rate limited)
console.log(limiter.allowRequest("user2")); // true (different user)
`,
    },
    // Teaching session
    {
      sessionId: teachingSession!.id,
      path: "main.go",
      isEntryPoint: true,
      content: `// Go Concurrency Workshop
// Lesson 1: Goroutines and Channels

package main

import (
\t"fmt"
\t"sync"
\t"time"
)

// Example 1: Basic goroutine with channel
func producer(ch chan<- int, id int) {
\tfor i := 0; i < 5; i++ {
\t\tch <- id*100 + i
\t\ttime.Sleep(100 * time.Millisecond)
\t}
}

// Example 2: Fan-in pattern
func fanIn(channels ...<-chan int) <-chan int {
\tout := make(chan int)
\tvar wg sync.WaitGroup

\tfor _, ch := range channels {
\t\twg.Add(1)
\t\tgo func(c <-chan int) {
\t\t\tdefer wg.Done()
\t\t\tfor v := range c {
\t\t\t\tout <- v
\t\t\t}
\t\t}(ch)
\t}

\tgo func() {
\t\twg.Wait()
\t\tclose(out)
\t}()

\treturn out
}

func main() {
\t// Create channels for two producers
\tch1 := make(chan int, 5)
\tch2 := make(chan int, 5)

\t// Start producers
\tgo producer(ch1, 1)
\tgo producer(ch2, 2)

\t// Close channels after producers finish
\tgo func() {
\t\ttime.Sleep(600 * time.Millisecond)
\t\tclose(ch1)
\t\tclose(ch2)
\t}()

\t// Fan-in: merge both channels
\tmerged := fanIn(ch1, ch2)

\t// Consume merged output
\tfor val := range merged {
\t\tfmt.Printf("Received: %d\\n", val)
\t}

\tfmt.Println("All producers finished!")
}
`,
    },
    // Sandbox session
    {
      sessionId: sandboxSession!.id,
      path: "main.rs",
      isEntryPoint: true,
      content: `// Rust Playground - Ownership & Borrowing

fn main() {
    // Ownership example
    let s1 = String::from("hello");
    let s2 = s1.clone();
    println!("s1 = {}, s2 = {}", s1, s2);

    // Borrowing example
    let s3 = String::from("world");
    let len = calculate_length(&s3);
    println!("The length of '{}' is {}.", s3, len);

    // Mutable reference
    let mut s4 = String::from("hello");
    change(&mut s4);
    println!("Changed: {}", s4);

    // Struct with lifetime
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence;
    {
        let i = novel.find('.').unwrap_or(novel.len());
        first_sentence = &novel[..i];
    }
    println!("First sentence: {}", first_sentence);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}

fn change(s: &mut String) {
    s.push_str(", world!");
}
`,
    },
  ]);

  // ─── Execution History ────────────────────────────────────
  console.log("  Creating execution history...");
  await db.insert(schema.executions).values([
    {
      sessionId: pairSession!.id,
      userId: alice!.id,
      language: "python",
      status: "completed",
      stdout: "[0, 1]\n[1, 2]\n[0, 1]\n",
      stderr: "",
      exitCode: 0,
      executionTimeMs: 45,
      memoryUsedBytes: 8_400_000,
      completedAt: new Date(),
    },
    {
      sessionId: interviewSession!.id,
      userId: eve!.id,
      language: "javascript",
      status: "completed",
      stdout: "true\ntrue\ntrue\nfalse\ntrue\n",
      stderr: "",
      exitCode: 0,
      executionTimeMs: 32,
      memoryUsedBytes: 12_000_000,
      completedAt: new Date(),
    },
  ]);

  // ─── Questions ────────────────────────────────────────────
  console.log("  Creating question bank...");
  await db.insert(schema.questions).values([
    {
      title: "Two Sum",
      description:
        "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
      difficulty: "easy",
      tags: ["arrays", "hash-map"],
      language: "python",
      starterCode: "def two_sum(nums: list[int], target: int) -> list[int]:\n    pass\n",
      solutionCode:
        "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i\n",
      testCases: [
        { input: "[2,7,11,15], 9", expectedOutput: "[0, 1]", isHidden: false },
        { input: "[3,2,4], 6", expectedOutput: "[1, 2]", isHidden: false },
        { input: "[3,3], 6", expectedOutput: "[0, 1]", isHidden: true },
      ],
      timeLimitMinutes: 15,
      createdBy: admin!.id,
      orgId: acmeId,
      isPublic: true,
    },
    {
      title: "Valid Parentheses",
      description:
        'Given a string s containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.',
      difficulty: "easy",
      tags: ["stack", "strings"],
      language: "python",
      starterCode: "def is_valid(s: str) -> bool:\n    pass\n",
      testCases: [
        { input: '"()"', expectedOutput: "True", isHidden: false },
        { input: '"()[]{}"', expectedOutput: "True", isHidden: false },
        { input: '"(]"', expectedOutput: "False", isHidden: false },
        { input: '"([)]"', expectedOutput: "False", isHidden: true },
      ],
      timeLimitMinutes: 10,
      createdBy: admin!.id,
      orgId: acmeId,
      isPublic: true,
    },
    {
      title: "LRU Cache",
      description:
        "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the `LRUCache` class:\n- `LRUCache(capacity)` Initialize the LRU cache with positive size capacity.\n- `get(key)` Return the value of the key if it exists, otherwise return -1.\n- `put(key, value)` Update the value of the key if the key exists. Otherwise, add the key-value pair. If the number of keys exceeds the capacity, evict the least recently used key.",
      difficulty: "medium",
      tags: ["design", "hash-map", "linked-list"],
      language: "python",
      starterCode:
        "class LRUCache:\n    def __init__(self, capacity: int):\n        pass\n\n    def get(self, key: int) -> int:\n        pass\n\n    def put(self, key: int, value: int) -> None:\n        pass\n",
      testCases: [
        {
          input: '["LRUCache","put","put","get","put","get","put","get","get","get"], [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]',
          expectedOutput: "[null,null,null,1,null,-1,null,-1,3,4]",
          isHidden: false,
        },
      ],
      timeLimitMinutes: 30,
      createdBy: admin!.id,
      orgId: acmeId,
      isPublic: true,
    },
    {
      title: "Merge K Sorted Lists",
      description:
        "You are given an array of `k` linked lists, each linked list is sorted in ascending order.\n\nMerge all the linked lists into one sorted linked list and return it.",
      difficulty: "hard",
      tags: ["linked-list", "divide-and-conquer", "heap"],
      language: "python",
      starterCode:
        "class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef merge_k_lists(lists: list[ListNode]) -> ListNode:\n    pass\n",
      testCases: [
        {
          input: "[[1,4,5],[1,3,4],[2,6]]",
          expectedOutput: "[1,1,2,3,4,4,5,6]",
          isHidden: false,
        },
      ],
      timeLimitMinutes: 40,
      createdBy: admin!.id,
      orgId: acmeId,
      isPublic: true,
    },
    {
      title: "Rate Limiter",
      description:
        "Design a rate limiter that allows N requests per user within a sliding window of T seconds.",
      difficulty: "medium",
      tags: ["design", "sliding-window"],
      language: "javascript",
      starterCode:
        "class RateLimiter {\n  constructor(maxRequests, windowSizeMs) {\n    // TODO\n  }\n\n  allowRequest(userId) {\n    // TODO\n  }\n}\n",
      testCases: [
        {
          input: "RateLimiter(3, 1000) -> 4 requests from same user",
          expectedOutput: "true, true, true, false",
          isHidden: false,
        },
      ],
      timeLimitMinutes: 25,
      createdBy: bob!.id,
      orgId: acmeId,
      isPublic: true,
    },
    {
      title: "Binary Search Tree Iterator",
      description: "Implement the BSTIterator class with `next()` and `hasNext()` methods for in-order traversal.",
      difficulty: "medium",
      tags: ["tree", "iterator", "stack"],
      language: "java",
      starterCode: 'public class BSTIterator {\n    public BSTIterator(TreeNode root) {\n    }\n    \n    public int next() {\n        return 0;\n    }\n    \n    public boolean hasNext() {\n        return false;\n    }\n}\n',
      testCases: [
        { input: "[7,3,15,null,null,9,20]", expectedOutput: "3,7,9,15,20", isHidden: false },
      ],
      timeLimitMinutes: 20,
      createdBy: admin!.id,
      orgId: acmeId,
      isPublic: true,
    },
    {
      title: "Goroutine Pipeline",
      description: "Implement a concurrent pipeline using Go goroutines and channels that processes data through multiple stages.",
      difficulty: "medium",
      tags: ["concurrency", "channels", "goroutines"],
      language: "go",
      starterCode: 'package main\n\nfunc pipeline(input <-chan int) <-chan int {\n\t// TODO: implement pipeline stages\n\treturn nil\n}\n',
      testCases: [
        { input: "[1,2,3,4,5]", expectedOutput: "pipeline output in order", isHidden: false },
      ],
      timeLimitMinutes: 25,
      createdBy: charlie!.id,
      orgId: startupId,
      isPublic: false,
    },
    {
      title: "Memory-Safe Linked List",
      description: "Implement a singly linked list in Rust with proper ownership semantics.",
      difficulty: "medium",
      tags: ["ownership", "generics", "data-structures"],
      language: "rust",
      starterCode: "pub struct List<T> {\n    head: Option<Box<Node<T>>>,\n}\n\nstruct Node<T> {\n    val: T,\n    next: Option<Box<Node<T>>>,\n}\n\nimpl<T> List<T> {\n    pub fn new() -> Self {\n        List { head: None }\n    }\n\n    pub fn push(&mut self, val: T) {\n        // TODO\n    }\n\n    pub fn pop(&mut self) -> Option<T> {\n        // TODO\n        None\n    }\n}\n",
      testCases: [
        { input: "push(1), push(2), pop()", expectedOutput: "Some(2)", isHidden: false },
      ],
      timeLimitMinutes: 30,
      createdBy: diana!.id,
      orgId: startupId,
      isPublic: false,
    },
  ]);

  // ─── Assessments ──────────────────────────────────────────
  console.log("  Creating assessments...");
  const questionsList = await db.select().from(schema.questions).limit(3);
  await db.insert(schema.assessments).values([
    {
      title: "Junior Developer Screen",
      questionIds: questionsList.slice(0, 2).map((q) => q.id),
      totalTimeLimitMinutes: 30,
      createdBy: admin!.id,
      orgId: acmeId,
    },
    {
      title: "Senior Engineer Assessment",
      questionIds: questionsList.map((q) => q.id),
      totalTimeLimitMinutes: 90,
      createdBy: bob!.id,
      orgId: acmeId,
    },
  ]);

  // ─── Evaluations ──────────────────────────────────────────
  console.log("  Creating evaluations...");
  await db.insert(schema.evaluations).values([
    {
      sessionId: interviewSession!.id,
      candidateId: eve!.id,
      evaluatorId: bob!.id,
      rubricScores: [
        { dimension: "Problem Solving", score: 4, comment: "Good approach, identified edge cases" },
        { dimension: "Code Quality", score: 3, comment: "Readable but could optimize" },
        { dimension: "Communication", score: 5, comment: "Excellent explanation of thought process" },
        { dimension: "Testing", score: 4, comment: "Wrote comprehensive test cases" },
        { dimension: "Time Management", score: 4, comment: "Completed within time limit" },
      ],
      notes: "Strong candidate, good communication skills. Consider for next round.",
      overallScore: 4,
    },
    {
      sessionId: interviewSession!.id,
      candidateId: eve!.id,
      evaluatorId: alice!.id,
      rubricScores: [
        { dimension: "Problem Solving", score: 4, comment: "Methodical approach" },
        { dimension: "Code Quality", score: 4, comment: "Clean code" },
        { dimension: "Communication", score: 4, comment: "Clear explanations" },
        { dimension: "Testing", score: 3, comment: "Could test more edge cases" },
        { dimension: "Time Management", score: 5, comment: "Very efficient" },
      ],
      notes: "Recommend advancing to system design round.",
      overallScore: 4,
    },
  ]);

  // ─── Audit Log ────────────────────────────────────────────
  console.log("  Creating audit log entries...");
  await db.insert(schema.auditLog).values([
    {
      userId: admin!.id,
      action: "user.create",
      resource: "users",
      details: { email: "alice@acme.com" },
      ipAddress: "192.168.1.100",
    },
    {
      userId: alice!.id,
      action: "session.create",
      resource: "sessions",
      resourceId: pairSession!.id,
      details: { title: "Algorithm Practice - Two Sum", language: "python" },
      ipAddress: "192.168.1.101",
    },
    {
      userId: bob!.id,
      action: "session.create",
      resource: "sessions",
      resourceId: interviewSession!.id,
      details: { title: "Senior Engineer Interview", language: "javascript" },
      ipAddress: "192.168.1.102",
    },
    {
      userId: eve!.id,
      action: "session.join",
      resource: "sessions",
      resourceId: interviewSession!.id,
      details: { role: "editor" },
      ipAddress: "10.0.0.50",
    },
    {
      userId: bob!.id,
      action: "evaluation.create",
      resource: "evaluations",
      details: { candidateEmail: "eve@example.com", overallScore: 4 },
      ipAddress: "192.168.1.102",
    },
  ]);

  console.log("");
  console.log("Seed completed successfully!");
  console.log("");
  console.log("  Users:");
  console.log("    admin@codepad.io  / admin123     (Admin)");
  console.log("    alice@acme.com    / password123   (Acme Corp)");
  console.log("    bob@acme.com      / password123   (Acme Corp)");
  console.log("    charlie@startup.com / password123 (Startup Inc)");
  console.log("    diana@startup.com / password123   (Startup Inc)");
  console.log("    eve@example.com   / password123   (Candidate)");
  console.log("");
  console.log("  Sessions:");
  console.log("    PAR123 - Python pair programming (Alice + Bob)");
  console.log("    INT456 - JS interview (Bob + Alice interviewing Eve)");
  console.log("    TCH789 - Go teaching (Charlie)");
  console.log("    SBX000 - Rust sandbox (Diana)");
  console.log("");
  console.log("  Question Bank: 8 questions across Python, JS, Java, Go, Rust");
  console.log("  Assessments: 2 (Junior Screen, Senior Assessment)");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
