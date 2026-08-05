import express from "express";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import multer from "multer";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Safe module loading for CommonJS dependencies in both ESM (dev) and CJS (prod build)
const cjsRequire =
  typeof require !== "undefined"
    ? require
    : createRequire(import.meta.url);

const pdfParseModule = cjsRequire("pdf-parse");
const PDFDocument = cjsRequire("pdfkit");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Seed Data & Memory State
let users = [
  {
    id: "usr-student-1",
    name: "Alex Rivera",
    email: "student@studylens.edu",
    role: "student",
    studentId: "2024-STU-0841",
    department: "Computer Science",
    createdAt: "2024-01-15T08:00:00.000Z",
  },
  {
    id: "usr-teacher-1",
    name: "Prof. Maria Santos",
    email: "teacher@studylens.edu",
    role: "teacher",
    department: "Computer Science & IT",
    createdAt: "2023-09-01T08:00:00.000Z",
  },
  {
    id: "usr-admin-1",
    name: "Dr. Arthur Vance",
    email: "admin@studylens.edu",
    role: "admin",
    department: "Academic Affairs",
    createdAt: "2023-08-01T08:00:00.000Z",
  },
  {
    id: "usr-student-2",
    name: "Samantha Cruz",
    email: "samantha@studylens.edu",
    role: "student",
    studentId: "2024-STU-0912",
    department: "Data Science",
    createdAt: "2024-02-10T08:00:00.000Z",
  },
];

let subjects = [
  {
    id: "sub-101",
    code: "CS 301",
    name: "Data Structures & Algorithms",
    description: "Fundamental data structures, search trees, graphs, sorting algorithms, and complexity analysis.",
    teacherId: "usr-teacher-1",
    teacherName: "Prof. Maria Santos",
    studentCount: 38,
    materialCount: 6,
    createdAt: "2024-01-10T08:00:00.000Z",
  },
  {
    id: "sub-102",
    code: "AI 402",
    name: "Artificial Intelligence & Neural Networks",
    description: "Machine learning principles, deep learning, prompt engineering, and modern generative models.",
    teacherId: "usr-teacher-1",
    teacherName: "Prof. Maria Santos",
    studentCount: 29,
    materialCount: 4,
    createdAt: "2024-01-12T08:00:00.000Z",
  },
  {
    id: "sub-103",
    code: "DB 204",
    name: "Database Systems & Architecture",
    description: "Relational database design, SQL querying, indexing, normalized forms, and transaction processing.",
    teacherId: "usr-teacher-1",
    teacherName: "Prof. Maria Santos",
    studentCount: 45,
    materialCount: 5,
    createdAt: "2024-01-14T08:00:00.000Z",
  },
];

let materials = [
  {
    id: "mat-1",
    title: "Graph Traversal & BFS vs DFS Lecture Notes",
    description: "Comprehensive notes covering Breadth-First Search, Depth-First Search, and shortest path algorithms.",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    fileType: "pdf",
    fileSize: "2.4 MB",
    extractedText: `Graph Traversal Algorithms: Breadth-First Search (BFS) and Depth-First Search (DFS). BFS explores neighbor nodes first before moving to the next level using a Queue (FIFO). Time complexity is O(V + E). DFS explores as deep as possible along each branch before backtracking using a Stack or Recursion (LIFO). Applications of BFS include finding the shortest path in unweighted graphs and web crawlers. Applications of DFS include topological sorting, cycle detection, and maze solving. Binary Search Trees (BST) maintain left child < root < right child. In-order traversal of a BST yields elements in sorted order.`,
    uploadedBy: "Prof. Maria Santos",
    uploaderRole: "teacher",
    uploaderId: "usr-teacher-1",
    materialType: "course",
    createdAt: "2024-02-01T10:00:00.000Z",
  },
  {
    id: "mat-2",
    title: "Relational Database Normalization (1NF to 3NF)",
    description: "Guide on database anomalies, functional dependencies, 1NF, 2NF, and 3NF decomposition.",
    subjectId: "sub-103",
    subjectName: "DB 204 - Database Systems & Architecture",
    fileType: "docx",
    fileSize: "1.1 MB",
    extractedText: `Database Normalization is the process of structuring a relational database in accordance with normal forms to reduce data redundancy and improve data integrity. 1NF requires atomic values and no repeating groups. 2NF requires 1NF and no partial dependencies on composite primary keys. 3NF requires 2NF and no transitive dependencies (non-key attribute depending on another non-key attribute). BCNF is a stricter version where every determinant is a candidate key. Indexing using B-Trees significantly speeds up SQL SELECT queries but adds minor overhead to INSERT and UPDATE operations.`,
    uploadedBy: "Prof. Maria Santos",
    uploaderRole: "teacher",
    uploaderId: "usr-teacher-1",
    materialType: "course",
    createdAt: "2024-02-05T14:30:00.000Z",
  },
  {
    id: "mat-3",
    title: "Neural Networks & Backpropagation Foundations",
    description: "Slides introducing artificial neurons, activation functions (ReLU, Sigmoid), and gradient descent.",
    subjectId: "sub-102",
    subjectName: "AI 402 - Artificial Intelligence",
    fileType: "pptx",
    fileSize: "3.8 MB",
    extractedText: `Artificial Neural Networks (ANN) are computational models inspired by biological neural brains. An artificial neuron takes weighted inputs, sums them with a bias, and passes the result through an activation function like ReLU (Rectified Linear Unit), Sigmoid, or Softmax. Loss functions compute the error between prediction and true target. Backpropagation uses the chain rule of calculus to calculate gradients of the loss function with respect to every weight in the network, allowing Optimizer algorithms like Adam or SGD to update weights and minimize loss.`,
    uploadedBy: "Prof. Maria Santos",
    uploaderRole: "teacher",
    uploaderId: "usr-teacher-1",
    materialType: "course",
    createdAt: "2024-02-12T09:15:00.000Z",
  },
  {
    id: "mat-101",
    title: "Alex's Exam Reviewer: Dynamic Programming Patterns",
    description: "Self-prepared study notes on Memoization, Tabulation, and Common DP Problems (Knapsack, LCS).",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    fileType: "txt",
    fileSize: "0.5 MB",
    extractedText: `Dynamic Programming (DP) is an optimization technique over plain recursion. It breaks down a problem into subproblems, solves each subproblem once, and stores its answer in a table (Memoization for Top-Down, Tabulation for Bottom-Up). Key patterns: 1) 0/1 Knapsack Problem, 2) Longest Common Subsequence (LCS), 3) Coin Change Problem, 4) Fibonacci Sequence. Time complexity reduces from O(2^N) to O(N * W).`,
    uploadedBy: "Alex Rivera",
    uploaderRole: "student",
    uploaderId: "usr-student-1",
    materialType: "personal",
    createdAt: "2024-02-15T11:00:00.000Z",
  },
];

let quizzes = [
  {
    id: "quiz-101",
    title: "Midterm Assessment: Graph Algorithms & BST",
    description: "Test your knowledge of graph traversals, time complexities, queue/stack usage, and binary search trees.",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    materialId: "mat-1",
    createdById: "usr-teacher-1",
    createdByName: "Prof. Maria Santos",
    quizType: "teacher",
    isPublished: true,
    timeLimitMinutes: 15,
    passPercentage: 70,
    difficulty: "medium",
    createdAt: "2024-02-10T10:00:00.000Z",
    questions: [
      {
        id: "q1",
        question: "Which data structure is primarily used to implement Breadth-First Search (BFS)?",
        type: "multiple_choice",
        options: ["Queue (FIFO)", "Stack (LIFO)", "Priority Queue", "Array List"],
        correctAnswer: 0,
        explanation: "BFS explores level by level, so a FIFO Queue ensures nodes are processed in the order they are visited.",
        bloomsLevel: "Remembering",
        difficulty: "easy",
        topicTag: "Graph Traversal",
      },
      {
        id: "q2",
        question: "What is the time complexity of Breadth-First Search on a graph with V vertices and E edges?",
        type: "multiple_choice",
        options: ["O(V + E)", "O(V * E)", "O(V^2)", "O(log V)"],
        correctAnswer: 0,
        explanation: "Every vertex and edge is processed once during BFS, giving O(V + E) time complexity.",
        bloomsLevel: "Understanding",
        difficulty: "easy",
        topicTag: "Complexity Analysis",
      },
      {
        id: "q3",
        question: "Depth-First Search (DFS) can be implemented using recursion because recursion inherently uses a call stack.",
        type: "true_false",
        options: ["True", "False"],
        correctAnswer: 0,
        explanation: "True. Function recursion uses the runtime call stack, matching DFS LIFO behavior.",
        bloomsLevel: "Understanding",
        difficulty: "medium",
        topicTag: "DFS & Recursion",
      },
      {
        id: "q4",
        question: "In a Binary Search Tree (BST), performing an in-order traversal yields the node values in sorted ascending order.",
        type: "true_false",
        options: ["True", "False"],
        correctAnswer: 0,
        explanation: "In-order traversal visits (Left, Root, Right), producing values in non-decreasing sorted order.",
        bloomsLevel: "Applying",
        difficulty: "medium",
        topicTag: "Binary Search Trees",
      },
      {
        id: "q5",
        question: "Compare BFS and DFS: which algorithm is guaranteed to find the shortest path in an unweighted graph?",
        type: "multiple_choice",
        options: ["BFS", "DFS", "Both find shortest path equally", "Neither algorithm"],
        correctAnswer: 0,
        explanation: "BFS explores outward level-by-level, making it guaranteed to find the shortest path in terms of edge count for unweighted graphs.",
        bloomsLevel: "Analyzing",
        difficulty: "hard",
        topicTag: "Graph Traversal",
      },
    ],
  },
  {
    id: "quiz-102",
    title: "Database Normalization & 3NF Quiz",
    description: "Evaluates understanding of 1NF, 2NF, 3NF, functional dependencies, and transitive dependencies.",
    subjectId: "sub-103",
    subjectName: "DB 204 - Database Systems & Architecture",
    materialId: "mat-2",
    createdById: "usr-teacher-1",
    createdByName: "Prof. Maria Santos",
    quizType: "teacher",
    isPublished: true,
    timeLimitMinutes: 20,
    passPercentage: 70,
    difficulty: "medium",
    createdAt: "2024-02-15T11:00:00.000Z",
    questions: [
      {
        id: "q10",
        question: "Which normal form prohibits transitive dependencies among non-key attributes?",
        type: "multiple_choice",
        options: ["First Normal Form (1NF)", "Second Normal Form (2NF)", "Third Normal Form (3NF)", "BCNF"],
        correctAnswer: 2,
        explanation: "3NF eliminates transitive dependencies (X -> Y where Y -> Z and Z is non-key).",
        bloomsLevel: "Remembering",
        difficulty: "easy",
        topicTag: "Database Normalization",
      },
      {
        id: "q11",
        question: "Partial functional dependencies occur when a non-key attribute depends on only part of a composite primary key.",
        type: "true_false",
        options: ["True", "False"],
        correctAnswer: 0,
        explanation: "True. 2NF removes partial key dependencies.",
        bloomsLevel: "Understanding",
        difficulty: "medium",
        topicTag: "Database Normalization",
      },
    ],
  },
  {
    id: "quiz-103",
    title: "Alex's Personal Practice Drill: Algorithms",
    description: "Personal self-study practice drill created by student Alex Rivera for graph traversals and trees.",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    createdById: "usr-student-1",
    createdByName: "Alex Rivera",
    quizType: "student",
    isPublished: true,
    timeLimitMinutes: 10,
    passPercentage: 60,
    difficulty: "easy",
    createdAt: "2024-02-18T14:00:00.000Z",
    questions: [
      {
        id: "sq1",
        question: "True or False: A Tree is a special type of connected acyclic Graph.",
        type: "true_false",
        options: ["True", "False"],
        correctAnswer: 0,
        explanation: "A tree is an undirected, connected graph with no cycles.",
        bloomsLevel: "Understanding",
        difficulty: "easy",
        topicTag: "Graph Basics",
      },
      {
        id: "sq2",
        question: "What is the maximum number of children a node can have in a Binary Tree?",
        type: "multiple_choice",
        options: ["1", "2", "3", "Unlimited"],
        correctAnswer: 1,
        explanation: "By definition, binary tree nodes have at most two children (left and right).",
        bloomsLevel: "Remembering",
        difficulty: "easy",
        topicTag: "Trees",
      },
    ],
  },
];

const flashcardDecks = [
  {
    id: "deck-1",
    title: "Graph Algorithms Core Terms",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures",
    materialId: "mat-1",
    isPublished: true,
    createdById: "usr-teacher-1",
    createdAt: "2024-02-02T10:00:00.000Z",
    cards: [
      {
        id: "fc1",
        question: "What is Breadth-First Search (BFS)?",
        answer: "A graph traversal algorithm that explores nodes level-by-level starting from a root, using a Queue.",
        topicTag: "Graph Traversal",
        difficulty: "easy",
      },
      {
        id: "fc2",
        question: "What is Depth-First Search (DFS)?",
        answer: "A graph traversal algorithm that explores as deep as possible along each branch before backtracking, using a Stack or Recursion.",
        topicTag: "Graph Traversal",
        difficulty: "easy",
      },
      {
        id: "fc3",
        question: "What is the key property of a Binary Search Tree (BST)?",
        answer: "For every node, all values in its left subtree are smaller, and all values in its right subtree are larger.",
        topicTag: "Binary Search Trees",
        difficulty: "medium",
      },
      {
        id: "fc4",
        question: "What traversal order produces sorted BST values?",
        answer: "In-order traversal (Left -> Root -> Right).",
        topicTag: "Binary Search Trees",
        difficulty: "medium",
      },
    ],
  },
];

let summaries = [
  {
    id: "sum-1",
    title: "Summary: Graph Traversal & BFS vs DFS",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    materialId: "mat-1",
    createdById: "usr-teacher-1",
    createdAt: "2024-02-02T12:00:00.000Z",
    executiveSummary: "This lecture outlines the fundamental differences between Breadth-First Search (BFS) and Depth-First Search (DFS) algorithms, detailing their underlying data structures, time complexities O(V + E), and practical applications like shortest path calculation and topological sorting.",
    keyTakeaways: [
      "BFS uses a Queue (FIFO) and is ideal for shortest path in unweighted graphs.",
      "DFS uses a Stack / Recursion (LIFO) and is ideal for maze solving, cycle detection, and topological sorting.",
      "Binary Search Trees maintain ordered keys where in-order traversal yields sorted elements.",
    ],
    bulletPoints: [
      "BFS Time Complexity: O(V + E) using queue data structure.",
      "DFS Time Complexity: O(V + E) using call stack / explicit stack.",
      "BST property: Left child < Node < Right child.",
    ],
  },
];

let reviewers = [
  {
    id: "rev-1",
    title: "Comprehensive Study Reviewer: Data Structures",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    materialId: "mat-1",
    createdById: "usr-teacher-1",
    createdAt: "2024-02-03T14:00:00.000Z",
    overview: "In-depth review guide covering graph traversals, data structures, and tree properties prepared for upcoming departmental assessments.",
    topics: [
      {
        topic: "Graph Traversal Algorithms",
        overview: "Exploration methods for vertex connectivity and path discovery.",
        keyConcepts: [
          "BFS: Queue based, level order traversal.",
          "DFS: Stack based, deep branch exploration.",
          "Graph Representation: Adjacency Matrix vs Adjacency List.",
        ],
        formulasOrRules: ["Time Complexity: O(V + E)", "Space Complexity: O(V)"],
        sampleQuestions: [
          {
            question: "Why does BFS use a Queue while DFS uses a Stack?",
            answer: "BFS visits nearest neighbors first (FIFO), whereas DFS plunges deep into branch nodes before backtracking (LIFO).",
          },
        ],
      },
      {
        topic: "Binary Search Trees (BST)",
        overview: "Hierarchical node structure enabling efficient search and retrieval.",
        keyConcepts: [
          "BST In-variant: left < parent < right",
          "In-order traversal visits items in ascending order",
        ],
        formulasOrRules: ["Search/Insert Average Time: O(log N)", "Search/Insert Worst Case: O(N) for degenerate trees"],
        sampleQuestions: [
          {
            question: "What happens during in-order traversal of a BST?",
            answer: "It visits left child, root, then right child, generating elements in sorted order.",
          },
        ],
      },
    ],
  },
];

const quizAttempts = [
  {
    id: "att-101",
    quizId: "quiz-101",
    quizTitle: "Midterm Assessment: Graph Algorithms & BST",
    studentId: "usr-student-1",
    studentName: "Alex Rivera",
    subjectId: "sub-101",
    subjectName: "CS 301 - Data Structures & Algorithms",
    score: 4,
    maxScore: 5,
    percentage: 80,
    passed: true,
    answers: [
      { questionId: "q1", userAnswer: 0, isCorrect: true },
      { questionId: "q2", userAnswer: 0, isCorrect: true },
      { questionId: "q3", userAnswer: 0, isCorrect: true },
      { questionId: "q4", userAnswer: 0, isCorrect: true },
      { questionId: "q5", userAnswer: 1, isCorrect: false },
    ],
    weakTopics: ["Graph Traversal (Hard)"],
    strongTopics: ["Complexity Analysis", "DFS & Recursion", "Binary Search Trees"],
    completedAt: "2024-02-12T15:20:00.000Z",
  },
];

let announcements = [
  {
    id: "ann-1",
    title: "Welcome to StudyLens AI Platform!",
    content: "Prepare for your upcoming midterms by utilizing AI-generated flashcards, reviewers, and adaptive quizzes. Teachers have published new course study materials.",
    authorName: "Dr. Arthur Vance (Administrator)",
    targetAudience: "all",
    priority: "high",
    createdAt: "2024-02-01T08:00:00.000Z",
  },
  {
    id: "ann-2",
    title: "New Materials Uploaded for CS 301 & DB 204",
    content: "Prof. Maria Santos uploaded lecture notes on Graph Algorithms and Normalization. Take practice quizzes in your Student Dashboard.",
    authorName: "Prof. Maria Santos",
    targetAudience: "students",
    priority: "medium",
    createdAt: "2024-02-06T09:30:00.000Z",
  },
];

let systemSettings = {
  aiModel: "gemini-3.6-flash",
  maxTokens: 4096,
  temperature: 0.7,
  require2FA: false,
  maintenanceMode: false,
  sessionTimeoutMins: 60,
  autoAuditArchiving: true,
};

let activityLogs = [
  {
    id: "log-101",
    userId: "usr-admin-1",
    userName: "Dr. Arthur Vance",
    userRole: "admin",
    action: "SYSTEM_BOOT",
    details: "StudyLens AI Engine & Governance Gateway initialized successfully",
    ipAddress: "127.0.0.1",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "log-102",
    userId: "usr-teacher-1",
    userName: "Prof. Maria Santos",
    userRole: "teacher",
    action: "MATERIAL_UPLOAD",
    details: "Uploaded Graph Traversal & BFS vs DFS Lecture Notes for CS 301",
    ipAddress: "192.168.1.45",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "log-103",
    userId: "usr-student-1",
    userName: "Alex Rivera",
    userRole: "student",
    action: "QUIZ_SUBMIT",
    details: "Completed Midterm Assessment: Graph Algorithms & BST (Score: 80%)",
    ipAddress: "192.168.1.88",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "log-104",
    userId: "usr-admin-1",
    userName: "Dr. Arthur Vance",
    userRole: "admin",
    action: "ANNOUNCEMENT_POSTED",
    details: "Broadcast notice: Welcome to StudyLens AI Platform!",
    ipAddress: "192.168.1.2",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "log-105",
    userId: "usr-student-2",
    userName: "Samantha Cruz",
    userRole: "student",
    action: "AI_GENERATION",
    details: "Generated 5 Bloom's taxonomy flashcards for Data Science",
    ipAddress: "192.168.1.104",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
];

// Helper AI Call function
async function callGeminiAI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });
  return response.text || "";
}

// File Text Parsing Helper
async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const filename = file.originalname.toLowerCase();
  if (filename.endsWith(".pdf")) {
    try {
      if (typeof pdfParseModule === "function") {
        const parsed = await pdfParseModule(file.buffer);
        if (parsed && parsed.text) return parsed.text;
      } else if (pdfParseModule && typeof pdfParseModule.PDFParse === "function") {
        const parser = new pdfParseModule.PDFParse({ data: file.buffer });
        const result = await parser.getText();
        await parser.destroy();
        if (result && result.text) return result.text;
      } else if (pdfParseModule && typeof pdfParseModule.default === "function") {
        const parsed = await pdfParseModule.default(file.buffer);
        if (parsed && parsed.text) return parsed.text;
      }
    } catch (err) {
      console.warn("PDF parsing failed, falling back to raw text extraction:", err);
    }
    const rawText = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return rawText.length > 30 ? rawText : file.originalname;
  } else if (filename.endsWith(".docx") || filename.endsWith(".doc")) {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      if (result && result.value) return result.value;
    } catch (err) {
      console.warn("Mammoth docx parsing failed:", err);
    }
    return file.buffer.toString("utf-8");
  } else if (filename.endsWith(".pptx") || filename.endsWith(".ppt")) {
    const textStr = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    const cleaned = textStr.replace(/\s+/g, " ").trim();
    return cleaned.length > 50 ? cleaned : file.originalname;
  } else {
    return file.buffer.toString("utf-8");
  }
}

// REST API ROUTES

// 1. AUTH ROUTES
app.post("/api/auth/login", (req, res) => {
  const { email, user: customUser } = req.body;
  let { role } = req.body;

  let emailStr = "";
  if (typeof email === "string") {
    emailStr = email;
  } else if (email && typeof email === "object" && typeof email.email === "string") {
    emailStr = email.email;
    if (!role && email.role) role = email.role;
  }

  let user = users.find((u) => u.email.toLowerCase() === emailStr.toLowerCase());
  
  if (!user && role) {
    user = users.find((u) => u.role === role);
  }
  
  if (!user) {
    if (customUser && customUser.name && customUser.role) {
      user = {
        id: customUser.id || `usr-${Date.now()}`,
        name: customUser.name,
        email: emailStr || customUser.email || "user@studylens.edu",
        role: customUser.role,
        department: customUser.department || "General",
        createdAt: new Date().toISOString(),
      };
    } else {
      user = users[0]; // fallback default
    }
  }

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: user.id,
    userName: user.name,
    userRole: user.role as "student" | "teacher" | "admin",
    action: "USER_LOGIN",
    details: `User logged in as ${user.role}`,
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  });

  return res.json({
    token: `jwt-token-${user.id}-${Date.now()}`,
    user,
  });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, role = "student", department, studentId } = req.body;
  const newUser = {
    id: `usr-${Date.now()}`,
    name: name || "New User",
    email: email || `user${Date.now()}@studylens.edu`,
    role,
    department: department || "General Studies",
    studentId: studentId || `2024-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: newUser.id,
    userName: newUser.name,
    userRole: newUser.role as "student" | "teacher" | "admin",
    action: "USER_REGISTER",
    details: `Registered new ${newUser.role} account`,
    timestamp: new Date().toISOString(),
  });

  return res.json({ token: `jwt-token-${newUser.id}`, user: newUser });
});

// 2. USERS MANAGEMENT
app.get("/api/users", (req, res) => {
  const { role } = req.query;
  if (role) {
    return res.json(users.filter((u) => u.role === role));
  }
  return res.json(users);
});

app.post("/api/users", (req, res) => {
  const newUser = {
    id: `usr-${Date.now()}`,
    name: req.body.name,
    email: req.body.email,
    role: req.body.role || "student",
    department: req.body.department || "General Studies",
    studentId: req.body.studentId || (req.body.role === "student" ? `2024-STU-${Math.floor(1000 + Math.random() * 9000)}` : undefined),
    status: req.body.status || "active",
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: "usr-admin-1",
    userName: "Administrator",
    userRole: "admin",
    action: "USER_CREATED",
    details: `Created new ${newUser.role} account for ${newUser.name} (${newUser.email})`,
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  });

  return res.json(newUser);
});

app.put("/api/users/:id", (req, res) => {
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  
  const oldUser = { ...users[idx] };
  users[idx] = { ...users[idx], ...req.body };

  const changes: string[] = [];
  if (req.body.role && req.body.role !== oldUser.role) changes.push(`Role changed from ${oldUser.role} to ${req.body.role}`);
  if (req.body.status && req.body.status !== oldUser.status) changes.push(`Status set to ${req.body.status}`);
  if (req.body.department && req.body.department !== oldUser.department) changes.push(`Department updated to ${req.body.department}`);

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: "usr-admin-1",
    userName: "Administrator",
    userRole: "admin",
    action: req.body.status ? "USER_STATUS_CHANGED" : "USER_UPDATED",
    details: `Updated account for ${users[idx].name}: ${changes.join(", ") || "Profile modified"}`,
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  });

  return res.json(users[idx]);
});

app.delete("/api/users/:id", (req, res) => {
  const deletedUser = users.find((u) => u.id === req.params.id);
  users = users.filter((u) => u.id !== req.params.id);

  if (deletedUser) {
    activityLogs.unshift({
      id: `log-${Date.now()}`,
      userId: "usr-admin-1",
      userName: "Administrator",
      userRole: "admin",
      action: "USER_DELETED",
      details: `Terminated user account ${deletedUser.name} (${deletedUser.email})`,
      ipAddress: req.ip || "127.0.0.1",
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({ success: true });
});

// 3. SUBJECTS ROUTES
app.get("/api/subjects", (req, res) => {
  return res.json(subjects);
});

app.post("/api/subjects", (req, res) => {
  const newSubject = {
    id: `sub-${Date.now()}`,
    code: req.body.code,
    name: req.body.name,
    description: req.body.description || "",
    teacherId: req.body.teacherId || "usr-teacher-1",
    teacherName: req.body.teacherName || "Prof. Maria Santos",
    studentCount: 0,
    materialCount: 0,
    createdAt: new Date().toISOString(),
  };
  subjects.push(newSubject);
  return res.json(newSubject);
});

app.put("/api/subjects/:id", (req, res) => {
  const idx = subjects.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Subject not found" });
  subjects[idx] = { ...subjects[idx], ...req.body };
  return res.json(subjects[idx]);
});

app.delete("/api/subjects/:id", (req, res) => {
  subjects = subjects.filter((s) => s.id !== req.params.id);
  return res.json({ success: true });
});

// 4. LEARNING MATERIALS ROUTES
app.get("/api/materials", (req, res) => {
  const { subjectId, userId, uploaderId } = req.query;
  let result = materials;
  if (subjectId) {
    result = result.filter((m) => m.subjectId === subjectId);
  }

  // Privacy Rule:
  // Faculty/Teacher uploads (uploaderRole === "teacher") are public course materials.
  // Personal student uploads / notes (uploaderRole === "student") are strictly private to the student who uploaded them.
  const targetUserId = (userId || uploaderId) as string | undefined;
  if (targetUserId) {
    result = result.filter((m) => {
      const isTeacherMat =
        m.uploaderRole === "teacher" ||
        m.uploadedBy?.startsWith("Prof.") ||
        m.uploadedBy?.startsWith("Dr.");
      if (isTeacherMat) return true; // Faculty material visible to everyone
      return (
        m.uploaderId === targetUserId ||
        m.uploadedBy === targetUserId ||
        (m.uploaderId === undefined && (targetUserId === "usr-student-1" || targetUserId === "usr-student-2"))
      );
    });
  }

  return res.json(result);
});

app.post("/api/materials/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(400).json({ error: `File upload error: ${err.message || "File too large or invalid"}` });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { title, description, subjectId, textInput, uploadedBy, uploaderRole, uploaderId, materialType } = req.body;
    let extracted = textInput || "";
    let fileType = "txt";
    let fileSize = "100 KB";

    if (req.file) {
      extracted = await extractTextFromFile(req.file);
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "txt";
      fileType = ext as "pdf" | "ppt" | "doc" | "txt";
      fileSize = `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    const resolvedMaterialType = materialType || (uploaderRole === "student" ? "personal" : "course");
    const subject = subjects.find((s) => s.id === subjectId) || subjects[0];
    const isPersonal = resolvedMaterialType === "personal" || subjectId === "personal";
    const resolvedSubjectName = isPersonal
      ? "Personal Study Notes"
      : subject ? `${subject.code} - ${subject.name}` : "General Material";

    const newMaterial = {
      id: `mat-${Date.now()}`,
      title: title || req.file?.originalname || "Uploaded Material",
      description: description || (isPersonal ? "Personal self-study note" : "Uploaded course learning material"),
      subjectId: isPersonal ? "personal" : (subject?.id || "sub-101"),
      subjectName: resolvedSubjectName,
      fileType: fileType as "pdf" | "ppt" | "doc" | "txt",
      fileSize,
      extractedText: extracted,
      uploadedBy: uploadedBy || "User",
      uploaderRole: uploaderRole || "student",
      uploaderId: uploaderId || "usr-student-1",
      materialType: isPersonal ? "personal" : "course",
      createdAt: new Date().toISOString(),
    };

    materials.push(newMaterial);
    if (!isPersonal && subject) {
      subject.materialCount += 1;
    }

    activityLogs.unshift({
      id: `log-${Date.now()}`,
      userId: uploadedBy || "usr-student-1",
      userName: uploadedBy || "User",
      userRole: uploaderRole || "student",
      action: "MATERIAL_UPLOAD",
      details: `Uploaded ${newMaterial.title} (${isPersonal ? "Personal Study Note" : newMaterial.subjectName})`,
      timestamp: new Date().toISOString(),
    });

    return res.json(newMaterial);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Material upload error:", err);
    return res.status(500).json({ error: errorMsg || "Failed to process file upload" });
  }
});

app.delete("/api/materials/:id", (req, res) => {
  const mat = materials.find((m) => m.id === req.params.id);
  if (mat) {
    const sub = subjects.find((s) => s.id === mat.subjectId);
    if (sub && sub.materialCount > 0) sub.materialCount -= 1;
  }
  materials = materials.filter((m) => m.id !== req.params.id);
  return res.json({ success: true });
});

// 5. QUIZZES & ASSESSMENTS ROUTES
app.get("/api/quizzes", (req, res) => {
  const { isPublished, subjectId, studentId, quizType } = req.query;
  let result = quizzes;

  if (isPublished === "true") {
    result = result.filter((q) => q.isPublished);
  }
  if (subjectId) {
    result = result.filter((q) => q.subjectId === subjectId);
  }
  if (quizType) {
    result = result.filter((q) => (q.quizType || "teacher") === quizType);
  }

  // Privacy Rule: If a student ID is provided, filter student-created quizzes
  // so that student practice quizzes are only shown if createdById matches studentId.
  if (studentId) {
    result = result.filter((q) => {
      const type = q.quizType || (q.createdById?.startsWith("usr-teacher") ? "teacher" : "student");
      if (type === "teacher") return true; // Teacher subject quizzes are public to all
      return q.createdById === studentId; // Student practice quizzes are strictly private to that student
    });
  }

  return res.json(result);
});

app.get("/api/quizzes/:id", (req, res) => {
  const quiz = quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  return res.json(quiz);
});

app.post("/api/quizzes", (req, res) => {
  const {
    title,
    description,
    subjectId,
    questions,
    timeLimitMinutes,
    passPercentage,
    difficulty,
    isPublished,
    createdById,
    createdByName,
    quizType,
    uploaderRole,
  } = req.body;

  const subject = subjects.find((s) => s.id === subjectId) || subjects[0];
  
  // Determine if this is a Teacher Subject Quiz or Student Personal Practice Quiz
  let derivedType: "teacher" | "student" = quizType;
  if (!derivedType) {
    if (uploaderRole === "teacher" || createdById?.startsWith("usr-teacher")) {
      derivedType = "teacher";
    } else {
      derivedType = "student";
    }
  }

  const newQuiz = {
    id: `quiz-${Date.now()}`,
    title: title || "New Quiz",
    description: description || "",
    subjectId: subject.id,
    subjectName: `${subject.code} - ${subject.name}`,
    createdById: createdById || "usr-student-1",
    createdByName: createdByName || "Student User",
    quizType: derivedType,
    questions: questions || [],
    isPublished: isPublished ?? true,
    timeLimitMinutes: timeLimitMinutes || 15,
    passPercentage: passPercentage || 70,
    difficulty: difficulty || "medium",
    createdAt: new Date().toISOString(),
  };

  quizzes.push(newQuiz);
  return res.json(newQuiz);
});

app.put("/api/quizzes/:id", (req, res) => {
  const idx = quizzes.findIndex((q) => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Quiz not found" });
  
  let updatedSubjectName = quizzes[idx].subjectName;
  if (req.body.subjectId) {
    const sub = subjects.find((s) => s.id === req.body.subjectId);
    if (sub) {
      updatedSubjectName = `${sub.code} - ${sub.name}`;
    }
  }

  quizzes[idx] = { 
    ...quizzes[idx], 
    ...req.body,
    subjectName: updatedSubjectName,
  };
  return res.json(quizzes[idx]);
});

app.delete("/api/quizzes/:id", (req, res) => {
  quizzes = quizzes.filter((q) => q.id !== req.params.id);
  return res.json({ success: true });
});

app.post("/api/quizzes/:id/submit", (req, res) => {
  const quiz = quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  const { studentId, studentName, userAnswers } = req.body; // userAnswers: { [qId]: answer }
  let correctCount = 0;
  const answerSubmissions: Array<{ questionId: string; userAnswer: unknown; isCorrect: boolean }> = [];
  const weakTopicsSet = new Set<string>();
  const strongTopicsSet = new Set<string>();

  quiz.questions.forEach((q) => {
    const userAns = userAnswers[q.id];
    let isCorrect = false;

    if (q.type === "multiple_choice" || q.type === "true_false") {
      isCorrect = Number(userAns) === Number(q.correctAnswer);
    } else {
      isCorrect = String(userAns || "").trim().toLowerCase() === String(q.correctAnswer || "").trim().toLowerCase();
    }

    if (isCorrect) {
      correctCount++;
      strongTopicsSet.add(q.topicTag || "General Concepts");
    } else {
      weakTopicsSet.add(q.topicTag || "General Concepts");
    }

    answerSubmissions.push({
      questionId: q.id,
      userAnswer: userAns,
      isCorrect,
    });
  });

  const total = quiz.questions.length || 1;
  const percentage = Math.round((correctCount / total) * 100);
  const passed = percentage >= (quiz.passPercentage || 70);

  const attempt = {
    id: `att-${Date.now()}`,
    quizId: quiz.id,
    quizTitle: quiz.title,
    studentId: studentId || "usr-student-1",
    studentName: studentName || "Alex Rivera",
    subjectId: quiz.subjectId,
    subjectName: quiz.subjectName,
    score: correctCount,
    maxScore: total,
    percentage,
    passed,
    answers: answerSubmissions,
    weakTopics: Array.from(weakTopicsSet),
    strongTopics: Array.from(strongTopicsSet),
    completedAt: new Date().toISOString(),
  };

  quizAttempts.unshift(attempt);

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: attempt.studentId,
    userName: attempt.studentName,
    userRole: "student",
    action: "QUIZ_COMPLETED",
    details: `Scored ${percentage}% (${correctCount}/${total}) on ${quiz.title}`,
    timestamp: new Date().toISOString(),
  });

  return res.json({ attempt });
});

// 6. FLASHCARDS, SUMMARIES, REVIEWERS
app.get("/api/flashcards", (req, res) => {
  const { userId, studentId, subjectId } = req.query;
  const targetId = (userId || studentId) as string | undefined;
  let result = flashcardDecks;
  if (subjectId) {
    result = result.filter((f) => f.subjectId === subjectId);
  }
  if (targetId) {
    result = result.filter((f) => {
      const isTeacherDeck = f.createdById?.startsWith("usr-teacher");
      if (isTeacherDeck) return true;
      return f.createdById === targetId;
    });
  }
  return res.json(result);
});

app.post("/api/flashcards", (req, res) => {
  const deck = { id: `deck-${Date.now()}`, createdAt: new Date().toISOString(), ...req.body };
  flashcardDecks.push(deck);
  return res.json(deck);
});

app.get("/api/summaries", (req, res) => {
  const { userId, studentId, subjectId } = req.query;
  const targetId = (userId || studentId) as string | undefined;
  let result = summaries;
  if (subjectId) {
    result = result.filter((s) => s.subjectId === subjectId);
  }
  if (targetId) {
    result = result.filter((s) => {
      const isTeacher = s.createdById?.startsWith("usr-teacher");
      if (isTeacher) return true;
      return s.createdById === targetId;
    });
  }
  return res.json(result);
});

app.post("/api/summaries", (req, res) => {
  const sum = { id: `sum-${Date.now()}`, createdAt: new Date().toISOString(), ...req.body };
  summaries.push(sum);
  return res.json(sum);
});

app.delete("/api/summaries/:id", (req, res) => {
  summaries = summaries.filter((s) => s.id !== req.params.id);
  return res.json({ success: true });
});

app.get("/api/reviewers", (req, res) => {
  const { userId, studentId, subjectId } = req.query;
  const targetId = (userId || studentId) as string | undefined;
  let result = reviewers;
  if (subjectId) {
    result = result.filter((r) => r.subjectId === subjectId);
  }
  if (targetId) {
    result = result.filter((r) => {
      const isTeacher = r.createdById?.startsWith("usr-teacher");
      if (isTeacher) return true;
      return r.createdById === targetId;
    });
  }
  return res.json(result);
});

app.post("/api/reviewers", (req, res) => {
  const rev = { id: `rev-${Date.now()}`, createdAt: new Date().toISOString(), ...req.body };
  reviewers.push(rev);
  return res.json(rev);
});

app.delete("/api/reviewers/:id", (req, res) => {
  reviewers = reviewers.filter((r) => r.id !== req.params.id);
  return res.json({ success: true });
});

// 7. STUDENT PROGRESS & ADAPTIVE RECOMMENDATIONS
app.get("/api/progress/:studentId", (req, res) => {
  const { studentId } = req.params;
  const studentAttempts = quizAttempts.filter((a) => a.studentId === studentId);
  const totalTaken = studentAttempts.length;
  const avgScore = totalTaken > 0 ? Math.round(studentAttempts.reduce((s, a) => s + a.percentage, 0) / totalTaken) : 0;
  
  const allWeak = studentAttempts.flatMap((a) => a.weakTopics);
  const allStrong = studentAttempts.flatMap((a) => a.strongTopics);

  const topicCountMap: Record<string, { total: number; correct: number }> = {};
  studentAttempts.forEach((att) => {
    att.answers.forEach((ans) => {
      const q = quizzes.flatMap((qz) => qz.questions).find((q) => q.id === ans.questionId);
      const topic = q?.topicTag || "General Concepts";
      if (!topicCountMap[topic]) topicCountMap[topic] = { total: 0, correct: 0 };
      topicCountMap[topic].total++;
      if (ans.isCorrect) topicCountMap[topic].correct++;
    });
  });

  const topicPerformances = Object.entries(topicCountMap).map(([topic, data]) => ({
    topic,
    totalQuestions: data.total,
    correctAnswers: data.correct,
    accuracyPercentage: Math.round((data.correct / data.total) * 100),
  }));

  return res.json({
    studentId,
    totalQuizzesTaken: totalTaken,
    averageScore: avgScore,
    totalMaterialsUploaded: materials.filter((m) => m.uploadedBy.includes("Alex") || m.uploaderRole === "student").length,
    completedFlashcardDecks: flashcardDecks.length,
    topicPerformances,
    weakTopics: Array.from(new Set(allWeak)),
    strongTopics: Array.from(new Set(allStrong)),
    recentQuizAttempts: studentAttempts.slice(0, 10),
  });
});

app.get("/api/recommendations/:studentId", (req, res) => {
  const { studentId } = req.params;
  const studentAttempts = quizAttempts.filter((a) => a.studentId === studentId);
  const weakTopics = Array.from(new Set(studentAttempts.flatMap((a) => a.weakTopics)));

  const recommendations = [];

  if (weakTopics.length > 0) {
    weakTopics.forEach((topic, idx) => {
      recommendations.push({
        id: `rec-${idx + 1}`,
        studentId,
        weakTopic: topic,
        recommendationType: "reviewer",
        title: `Targeted Reviewer: ${topic}`,
        description: `Your score dropped on ${topic}. Focus on these core formulas and key concepts to strengthen your understanding.`,
        targetId: reviewers[0]?.id || "rev-1",
        difficultyTarget: "medium",
        createdAt: new Date().toISOString(),
      });
      recommendations.push({
        id: `rec-${idx + 10}`,
        studentId,
        weakTopic: topic,
        recommendationType: "flashcard",
        title: `Concept Flashcard Drill: ${topic}`,
        description: `Practice 5 rapid flashcards focusing strictly on definitions and problem steps for ${topic}.`,
        targetId: flashcardDecks[0]?.id || "deck-1",
        difficultyTarget: "easy",
        createdAt: new Date().toISOString(),
      });
    });
  } else {
    recommendations.push({
      id: "rec-default-1",
      studentId,
      weakTopic: "General Graph Traversal",
      recommendationType: "quiz",
      title: "Adaptive Practice Quiz: Graphs & BFS/DFS",
      description: "Keep your high score sharp with Bloom's Taxonomy Level 3 (Applying) question practice.",
      targetId: quizzes[0]?.id || "quiz-101",
      difficultyTarget: "medium",
      createdAt: new Date().toISOString(),
    });
  }

  return res.json(recommendations);
});

// 8. ANNOUNCEMENTS, AUDIT LOGS & SYSTEM SETTINGS
app.get("/api/announcements", (req, res) => res.json(announcements));

app.post("/api/announcements", (req, res) => {
  const newAnn = {
    id: `ann-${Date.now()}`,
    title: req.body.title || "Announcement",
    content: req.body.content || "",
    authorName: req.body.authorName || "Administrator",
    targetAudience: req.body.targetAudience || "all",
    priority: req.body.priority || "medium",
    subjectId: req.body.subjectId,
    subjectName: req.body.subjectName,
    createdAt: new Date().toISOString(),
  };
  announcements.unshift(newAnn);

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: "usr-admin-1",
    userName: newAnn.authorName,
    userRole: "admin",
    action: "ANNOUNCEMENT_POSTED",
    details: `Broadcasted notice "${newAnn.title}" to target audience: ${newAnn.targetAudience}`,
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  });

  return res.json(newAnn);
});

app.put("/api/announcements/:id", (req, res) => {
  const idx = announcements.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Announcement not found" });

  announcements[idx] = { ...announcements[idx], ...req.body };

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: "usr-admin-1",
    userName: announcements[idx].authorName || "Administrator",
    userRole: "admin",
    action: "ANNOUNCEMENT_UPDATED",
    details: `Updated bulletin notice "${announcements[idx].title}"`,
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  });

  return res.json(announcements[idx]);
});

app.delete("/api/announcements/:id", (req, res) => {
  const deleted = announcements.find((a) => a.id === req.params.id);
  announcements = announcements.filter((a) => a.id !== req.params.id);

  if (deleted) {
    activityLogs.unshift({
      id: `log-${Date.now()}`,
      userId: "usr-admin-1",
      userName: "Administrator",
      userRole: "admin",
      action: "ANNOUNCEMENT_DELETED",
      details: `Removed announcement "${deleted.title}"`,
      ipAddress: req.ip || "127.0.0.1",
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({ success: true });
});

// Logs Endpoints (supports /api/logs and /api/activity-logs)
const handleGetLogs = (req: express.Request, res: express.Response) => {
  const { action, userRole, search } = req.query;
  let result = activityLogs;

  if (action && action !== "all") {
    result = result.filter((l) => l.action === action);
  }
  if (userRole && userRole !== "all") {
    result = result.filter((l) => l.userRole === userRole);
  }
  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    result = result.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        (l.ipAddress && l.ipAddress.includes(q))
    );
  }

  return res.json(result);
};

app.get("/api/logs", handleGetLogs);
app.get("/api/activity-logs", handleGetLogs);

app.post("/api/logs", (req, res) => {
  const newLog = {
    id: `log-${Date.now()}`,
    userId: req.body.userId || "usr-admin-1",
    userName: req.body.userName || "System Administrator",
    userRole: req.body.userRole || "admin",
    action: req.body.action || "SYSTEM_AUDIT",
    details: req.body.details || "Manual audit entry captured",
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  };
  activityLogs.unshift(newLog);
  return res.json(newLog);
});

app.delete("/api/logs", (req, res) => {
  activityLogs = [
    {
      id: `log-${Date.now()}`,
      userId: "usr-admin-1",
      userName: "Administrator",
      userRole: "admin",
      action: "AUDIT_LOGS_CLEARED",
      details: "Audit logs archived and cleared by Administrator",
      ipAddress: req.ip || "127.0.0.1",
      timestamp: new Date().toISOString(),
    },
  ];
  return res.json({ success: true, logs: activityLogs });
});

// System Settings Endpoints
app.get("/api/system/settings", (req, res) => res.json(systemSettings));
app.put("/api/system/settings", (req, res) => {
  systemSettings = { ...systemSettings, ...req.body };

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    userId: "usr-admin-1",
    userName: "Administrator",
    userRole: "admin",
    action: "SETTINGS_UPDATED",
    details: `System governance configuration updated: AI Model=${systemSettings.aiModel}, 2FA=${systemSettings.require2FA}`,
    ipAddress: req.ip || "127.0.0.1",
    timestamp: new Date().toISOString(),
  });

  return res.json(systemSettings);
});

// 9. UNIFIED AI GENERATION ROUTE (Gemini 3.6 Flash)
app.post("/api/ai/generate", async (req, res) => {
  try {
    const { mode, text, quizCount = 5, flashcardCount = 5, subjectName = "General Subject" } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Please provide text content or select a lecture material." });
    }

    if (mode === "quiz") {
      const prompt = `You are an AI Educational Specialist creating a Bloom's Taxonomy structured quiz for high-level study.

Source Content:
"${text.slice(0, 4000)}"

Instructions:
Generate exactly ${quizCount} quiz questions formatted as JSON matching this structure:
[
  {
    "id": "q1",
    "question": "Question text...",
    "type": "multiple_choice", // options: "multiple_choice", "true_false", "identification", "short_answer"
    "options": ["Option A", "Option B", "Option C", "Option D"], // required for multiple_choice & true_false
    "correctAnswer": 0, // index for multiple_choice/true_false, OR string text for identification/short_answer
    "explanation": "Detailed step-by-step explanation...",
    "bloomsLevel": "Remembering", // Bloom's taxonomy: "Remembering" (30%), "Understanding" (25%), "Applying" (20%), "Analyzing" (15%), "Evaluating" (10%)
    "difficulty": "medium", // "easy", "medium", "hard"
    "topicTag": "Key Concept Tag"
  }
]

Follow strict Bloom's Taxonomy distribution across the questions. Output VALID JSON only.`;

      const aiText = await callGeminiAI(prompt);
      const cleanJson = aiText.replace(/```json|```/g, "").trim();
      const parsedQuestions = JSON.parse(cleanJson);
      return res.json({ questions: parsedQuestions });
    }

    if (mode === "flashcards") {
      const prompt = `You are an AI Study Assistant creating flashcards for study materials.

Source Content:
"${text.slice(0, 4000)}"

Instructions:
Generate exactly ${flashcardCount} flashcards formatted as JSON:
[
  {
    "id": "fc1",
    "question": "Clear concept question?",
    "answer": "Concise accurate explanation with examples if present.",
    "topicTag": "Topic Name",
    "difficulty": "easy" // "easy", "medium", "hard"
  }
]
Output VALID JSON only.`;

      const aiText = await callGeminiAI(prompt);
      const cleanJson = aiText.replace(/```json|```/g, "").trim();
      const parsedCards = JSON.parse(cleanJson);
      return res.json({ cards: parsedCards });
    }

    if (mode === "summary") {
      const prompt = `You are an AI Educational Summarizer.

Source Content:
"${text.slice(0, 4000)}"

Instructions:
Generate a structured JSON summary matching:
{
  "executiveSummary": "A concise paragraph giving a high-level overview of the material.",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "bulletPoints": ["Detailed point 1", "Detailed point 2", "Detailed point 3"]
}
Output VALID JSON only.`;

      const aiText = await callGeminiAI(prompt);
      const cleanJson = aiText.replace(/```json|```/g, "").trim();
      const parsedSummary = JSON.parse(cleanJson);
      return res.json(parsedSummary);
    }

    if (mode === "reviewer") {
      const prompt = `You are an AI Academic Reviewer generator.

Source Content:
"${text.slice(0, 4000)}"

Instructions:
Generate a comprehensive study reviewer formatted as JSON:
{
  "overview": "Comprehensive review guide overview for ${subjectName}.",
  "topics": [
    {
      "topic": "Topic Name",
      "overview": "Topic breakdown...",
      "keyConcepts": ["Concept 1", "Concept 2"],
      "formulasOrRules": ["Rule 1", "Rule 2"],
      "sampleQuestions": [
        { "question": "Sample question?", "answer": "Detailed answer." }
      ]
    }
  ]
}
Output VALID JSON only.`;

      const aiText = await callGeminiAI(prompt);
      const cleanJson = aiText.replace(/```json|```/g, "").trim();
      const parsedReviewer = JSON.parse(cleanJson);
      return res.json(parsedReviewer);
    }

    return res.status(400).json({ error: "Invalid AI mode requested" });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("AI Generation Error:", err);
    return res.status(500).json({ error: errorMsg || "Failed to generate AI resources" });
  }
});

// PDF Conversion / Reviewer Export
app.post("/api/convert-to-pdf", async (req, res) => {
  try {
    const { title, content, items } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${(title || "StudyLens_Reviewer").replace(/\s+/g, "_")}.pdf"`);
      res.send(pdfBuffer);
    });

    doc.fontSize(22).fillColor("#1e3a8a").font("Helvetica-Bold").text(title || "StudyLens AI Study Reviewer", { align: "center" });
    doc.moveDown(1);

    if (content) {
      doc.fontSize(12).fillColor("#334155").font("Helvetica").text(content);
      doc.moveDown(1.5);
    }

    if (Array.isArray(items)) {
      items.forEach((item: { question?: string; topic?: string; answer?: string; overview?: string }, i: number) => {
        doc.fontSize(12).fillColor("#0f766e").font("Helvetica-Bold").text(`${i + 1}. ${item.question || item.topic || "Item"}`);
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor("#334155").font("Helvetica").text(`Answer / Detail: ${item.answer || item.overview || ""}`);
        doc.moveDown(1);
      });
    }

    doc.end();
  } catch (err: unknown) {
    console.error("PDF Export error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// POST AI Hint for quiz question
app.post("/api/hint", async (req, res) => {
  try {
    const { question, options } = req.body;
    const prompt = `Give a subtle, helpful 1-2 sentence educational hint for this question without directly revealing the answer choice:
Question: ${question}
${options ? `Options: ${options.join(", ")}` : ""}`;
    const hint = await callGeminiAI(prompt);
    return res.json({ hint });
  } catch {
    return res.json({ hint: "Focus on the core definitions and data structure properties involved in the question." });
  }
});

// Global API error handler (ensures JSON responses for /api requests)
app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith("/api") || req.originalUrl.startsWith("/api")) {
    console.error("Express API error captured:", err);
    return res.status(err.status || 500).json({
      error: err.message || "An unexpected server error occurred.",
    });
  }
  next(err);
});

// VITE & SERVER INITIALIZATION
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.get("*all", async (req, res, next) => {
      if (req.path.startsWith("/api") || req.originalUrl.startsWith("/api")) {
        return res.status(404).json({ error: `API endpoint ${req.originalUrl} not found` });
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      if (req.path.startsWith("/api") || req.originalUrl.startsWith("/api")) {
        return res.status(404).json({ error: `API endpoint ${req.originalUrl} not found` });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StudyLens AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
