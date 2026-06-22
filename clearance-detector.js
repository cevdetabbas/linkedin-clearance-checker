(function initializeClearanceDetector(globalObject) {
  const NEGATIVE_PATTERNS = [
    /\bno (?:active )?(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance (?:is )?required\b/i,
    /\b(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance (?:is )?not required\b/i,
    /\bdoes not require (?:an? )?(?:security )?clearance\b/i,
    /\bwithout (?:an? )?(?:security )?clearance\b/i,
    /\bno clearance necessary\b/i
  ];

  const OBTAINABLE_PATTERNS = [
    /\b(?:must|should) be (?:able|eligible) to obtain(?: and maintain)? (?:an? )?(?:u\.?s\.? |dod )?(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance\b/i,
    /\bability to obtain(?: and maintain)? (?:an? )?(?:u\.?s\.? |dod )?(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance\b/i,
    /\beligibility for (?:an? )?(?:u\.?s\.? |dod )?(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance\b/i,
    /\bmust be clearance eligible\b/i,
    /\bwilling(?:ness)? to (?:obtain|undergo)(?: and maintain)? (?:an? )?(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance\b/i
  ];

  const REQUIRED_PATTERNS = [
    /\b(?:active|current) (?:u\.?s\.? |dod )?(?:confidential|secret|top secret|ts\s*\/?\s*sci)(?:\/sci)?(?: security)? clearance\b/i,
    /\bmust (?:have|hold|possess|maintain) (?:an? )?(?:active|current)?\s*(?:u\.?s\.? |dod )?(?:confidential|secret|top secret|ts\s*\/?\s*sci)(?:\/sci)?(?: security)? clearance\b/i,
    /\b(?:security )?clearance (?:is |will be )?(?:required|mandatory)\b/i,
    /\brequires? (?:an? )?(?:active|current)?\s*(?:u\.?s\.? |dod )?(?:(?:confidential|secret|top secret|ts\s*\/?\s*sci)\s+)?(?:security )?clearance\b/i,
    /\b(?:minimum|required) clearance(?: level)?:?\s*(?:confidential|secret|top secret|ts\s*\/?\s*sci)\b/i,
    /\b(?:confidential|secret|top secret|ts\s*\/?\s*sci)(?: security)? clearance\b/i,
    /\b(?:active|current) (?:secret|top secret|ts\s*\/?\s*sci)\b/i,
    /\b(?:secret|top secret|ts\s*\/?\s*sci) (?:clearance )?(?:is )?(?:required|mandatory)\b/i,
    /\bpolygraph (?:examination )?(?:is )?(?:required|mandatory)\b/i,
    /\b(?:must )?(?:pass|complete|undergo) (?:an? )?(?:full scope|lifestyle|counterintelligence|ci)?\s*polygraph\b/i,
    /\b(?:full scope|lifestyle|counterintelligence|ci)\s+poly(?:graph)?\b/i
  ];

  const CLEARANCE_TERMS = [
    /\bsecurity clearance\b/i,
    /\bgovernment clearance\b/i,
    /\bclearance level\b/i,
    /\bts\s*\/\s*sci\b/i,
    /\btop secret\b/i,
    /\bpolygraph\b/i
  ];

  const CRITICAL_PATTERNS = [
    /\bts\s*\/\s*sci\b/i,
    /\btop secret(?:\/sci)?\b/i,
    /\b(?:full scope|lifestyle|counterintelligence|ci)\s+poly(?:graph)?\b/i,
    /\bpolygraph\b/i
  ];

  function normalize(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitClauses(text) {
    return normalize(text)
      .split(/(?<=[.!?;:])\s+|\n+/)
      .map((clause) => clause.trim())
      .filter(Boolean);
  }

  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[0]) {
        return match[0].replace(/\s+/g, " ").trim();
      }
    }
    return "";
  }

  function unique(values) {
    const result = [];
    const seen = new Set();
    for (const value of values) {
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(value);
      }
    }
    return result;
  }

  function analyze(text) {
    const clauses = splitClauses(text);
    const negativeMatches = [];
    const obtainableMatches = [];
    const requiredMatches = [];
    const reviewMatches = [];
    const criticalMatches = [];

    for (const clause of clauses) {
      const negative = firstMatch(clause, NEGATIVE_PATTERNS);
      if (negative) {
        negativeMatches.push(negative);
        continue;
      }

      const obtainable = firstMatch(clause, OBTAINABLE_PATTERNS);
      if (obtainable) {
        obtainableMatches.push(obtainable);
        const critical = firstMatch(clause, CRITICAL_PATTERNS);
        if (critical) criticalMatches.push(critical);
        continue;
      }

      const required = firstMatch(clause, REQUIRED_PATTERNS);
      if (required) {
        requiredMatches.push(required);
        const critical = firstMatch(clause, CRITICAL_PATTERNS);
        if (critical) criticalMatches.push(critical);
        continue;
      }

      const review = firstMatch(clause, CLEARANCE_TERMS);
      if (review) reviewMatches.push(review);
    }

    if (requiredMatches.length) {
      return {
        status: "required",
        matches: unique([...requiredMatches, ...obtainableMatches]).slice(0, 6),
        criticalMatches: unique(criticalMatches).slice(0, 4)
      };
    }

    if (obtainableMatches.length) {
      return {
        status: "obtainable",
        matches: unique(obtainableMatches).slice(0, 6),
        criticalMatches: unique(criticalMatches).slice(0, 4)
      };
    }

    if (reviewMatches.length) {
      return {
        status: "review",
        matches: unique(reviewMatches).slice(0, 6),
        criticalMatches: []
      };
    }

    if (negativeMatches.length) {
      return {
        status: "not_required",
        matches: unique(negativeMatches).slice(0, 6),
        criticalMatches: []
      };
    }

    return {
      status: "not_mentioned",
      matches: [],
      criticalMatches: []
    };
  }

  globalObject.ClearanceDetector = { analyze, normalize };
})(globalThis);
