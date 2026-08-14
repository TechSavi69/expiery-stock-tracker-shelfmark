Act as a Principal Software Architect and Cybersecurity Specialist. Perform a rigorous, industry-standard Production Readiness, Security, and Architecture Audit on the provided Micro-SaaS codebase.

Evaluate the codebase across the following 5 critical pillars:

1. Security & Authentication Audit:
- Identify OWASP Top 10 vulnerabilities (XSS, CSRF, SQL/NoSQL Injection, IDOR, CORS misconfigurations).
- Check for hardcoded secrets, API keys, or exposed environment variables.
- Audit input validation and sanitization on all API routes/forms (e.g., Zod, Yup, or Joi usage).
- Review authentication flow, session handling, and JWT/Cookie security flags (HttpOnly, Secure, SameSite).

2. Production Readiness & Error Handling:
- Check for unhandled promises, missing try-catch blocks, and edge-case crash risks.
- Audit global error boundaries, custom error handling, and production-safe logging (avoiding console.log leakages).
- Evaluate environment variable management (.env.example vs .env.production).

3. Scalability & Performance:
- Identify blocking operations, unnecessary re-renders (React/Next.js), and memory leaks.
- Review database querying efficiency (N+1 queries, missing indexes, unoptimized API fetches).
- Check caching strategies (SWR, React Query, Next.js revalidation, or Redis usage).

4. Code Quality & Maintainability:
- Assess adherence to Clean Code principles, SOLID design principles, and TypeScript strict mode adherence.
- Evaluate modularity, component abstraction, and folder structure standards.

5. Deliverables Required in Output:
- Scorecard: Assign a readiness score out of 100 with a Pass/Fail status for production deployment.
- Severity Breakdown: Categorize all issues into Critical, High, Medium, and Low severity.
- Code Patches: Provide the exact refactored code snippets for every Critical and High severity issue identified.
- Production Checklist: A concise bulleted checklist of final steps required before going live (e.g., headers, analytics, DB indexing).

Begin the audit on the attached codebase now.