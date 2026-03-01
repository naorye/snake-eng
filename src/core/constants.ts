export const STORAGE_KEY = "snake_letters_v4";

export const GRID = 16;
export const CELL = 1;
export const MIN_LEN = 3;
export const BASE_POINTS = 10;
export const PENALTY = 15;
export const SWIPE_THRESHOLD = 24;

export const COMBO_STEPS = [1, 1.2, 1.4, 1.6, 1.8, 2.0];
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const UI_FONT = '900 72px "Arial Black", "Avenir Next", "Trebuchet MS", sans-serif';
export const LETTER_FONT = '900 132px "Arial Black", "Verdana", sans-serif';

export const WORDS = [
  "cat", "dog", "sun", "book", "tree", "apple", "planet", "school", "flower", "friend",
  "bridge", "rocket", "window", "yellow", "banana", "memory", "orange", "animal", "silver",
];

export const COMPLIMENTS = {
  success: ["עבודה מקצועית.", "ביצוע ברמה גבוהה.", "חשיבה חדה וביצוע מדויק.", "כל הכבוד!"],
  milestone: ["רצף מקצועי!", "דיוק של מומחה.", "חד/ה כמו לייזר.", "מהלך חכם."],
  recovery: ["חזרה מעולה.", "תיקון מצוין.", "יפה שלא ויתרת."],
  rule: ["זה כבר רמה גבוהה.", "חוק קשה וביצוע נקי.", "שליטה מעולה באותיות."],
};

export const TOOL_DEFS = {
  shoes: { name: "נעלי מהירות", icon: "👟", durationMs: 6500, color: 0x39ff14 },
  wine: { name: "יין בלבול", icon: "🍷", durationMs: 5000, color: 0xff00b8 },
  magnet: { name: "מגנט", icon: "🧲", durationMs: 7000, color: 0x00f5ff },
  shield: { name: "מגן", icon: "🛡️", durationMs: 6200, color: 0x7b61ff },
  multiplier: { name: "ניקוד כפול", icon: "x2", durationMs: 6800, color: 0xff8a00 },
  slow: { name: "הילוך איטי", icon: "⏱", durationMs: 6000, color: 0xff3df2 },
};

export const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
