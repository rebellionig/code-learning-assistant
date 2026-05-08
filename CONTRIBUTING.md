# Contributing to Code Learning Assistant

Thank you for considering contributing! This project grows through community contributions — especially documentation updates and new language support.

## Ways to Contribute

### 1. Add or Update Language Documentation
The most valuable contribution. Documentation lives in the `/docs` folder as Markdown files.

**Adding a new language:**
1. Create `/docs/your-language.md` following the structure in `python.md` or `javascript.md`
2. Use only **links to official documentation** — do not copy or paste documentation text (copyright)
3. Add the language to the supported list in this file (see below)
4. Submit a pull request

**Updating existing documentation:**
- If a library has been deprecated or updated, update the relevant link
- If a new language version introduces important changes, add a note under "Version Notes"
- Keep links pointing to the latest stable version unless otherwise noted

**Documentation file structure:**
```markdown
# Language Name Documentation References

Official source: https://official-docs-url

## Core Concepts
### Topic
- Concept name: https://link-to-official-docs
```

### 2. Fix Bugs
- Open an issue describing the bug
- Fork the repo, fix it, submit a pull request
- Include steps to reproduce in the issue

### 3. Suggest Features
- Open a GitHub Issue with the label `enhancement`
- Describe the use case, not just the feature

---

## Currently Supported Languages

| Language | Docs file | Status |
|----------|-----------|--------|
| Python | `docs/python.md` | ✅ Complete |
| JavaScript | `docs/javascript.md` | ✅ Complete |
| Java | `docs/java.md` | 🔲 Needed |
| C++ | `docs/cpp.md` | 🔲 Needed |
| TypeScript | `docs/typescript.md` | 🔲 Needed |
| Go | `docs/go.md` | 🔲 Needed |
| Rust | `docs/rust.md` | 🔲 Needed |

---

## Pull Request Guidelines

- One PR per language or fix
- Keep commit messages clear: `docs: add Java references` or `fix: hint limit reset bug`
- Do not include `.env` files, API keys, or `data.db`
- Test locally before submitting (see README for setup)

---

## Code of Conduct

- Be respectful
- No copying of copyrighted documentation text — links only
- No AI-generated documentation dumps — quality over quantity
