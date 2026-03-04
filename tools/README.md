# Tools

Deterministic Python scripts for execution within the WAT framework.

## Conventions

- **One tool per file** — each script does one thing well
- **Docstring at top** — describe purpose, inputs, outputs, and dependencies
- **Use `.env` for secrets** — never hardcode API keys or credentials
- **Clear inputs/outputs** — accept arguments via CLI args or stdin, output to stdout or files
- **Error handling** — catch exceptions, print meaningful error messages, exit with non-zero codes on failure
- **Testable** — write scripts that can be tested in isolation

## File Naming

Use snake_case: `scrape_website.py`, `export_to_sheets.py`, `calculate_scores.py`

## Dependencies

If a tool requires Python packages beyond the standard library, document them in a comment at the top of the file or in a `requirements.txt`.
