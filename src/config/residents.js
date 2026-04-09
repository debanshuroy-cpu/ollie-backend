// Layer 1 — hardcoded resident profile
// This gets replaced by database in Layer 2

const dorothy = {
  id: "resident_001",
  name: "Dorothy",
  age: 78,
  occupation_past: "school librarian",
  interests: ["roses", "birds", "BBC period dramas"],
  family: {
    daughter: { name: "Sarah", location: "Boston", visits: "every 2 weeks" },
    son: { name: "Michael", location: "Denver", calls: "Sundays" }
  },
  health_notes: ["mild arthritis in left knee", "tends to downplay pain"],
  conversation_patterns: {
    morning_mood: "chatty",
    evening_mood: "quieter",
    topics_returns_to: ["her garden at old house", "late husband Gerald"]
  }
};

module.exports = { dorothy };
