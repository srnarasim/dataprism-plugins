# PRP Template: Adopting IronCalc as the Formula Engine for DataPrism

This Product Requirements Prompt (PRP) outlines requirements for integrating **IronCalc**—a Rust/WebAssembly-based open-source spreadsheet and formula engine—as the foundational calculation and formula processing component in the DataPrism platform.

---

## 1. Objective

Leverage IronCalc as a high-performance, Excel-compatible formula engine for DataPrism, enabling in-browser spreadsheet-style calculations, formula evaluation, and interoperability with the platform’s extensible analytics ecosystem.

---

## 2. Scope

- Integration of IronCalc (Rust/WASM core, JavaScript bindings) as a DataPrism plugin.
- Support for formula parsing, evaluation, and Excel-like calculation workflows.
- Maintenance of compatibility with DataPrism’s plugin architecture and user interface paradigms.

---

## 3. Functional Requirements

- **Core Engine Integration**
  - Compile IronCalc Rust code to WebAssembly for browser execution[1][2][3].
  - Expose IronCalc’s calculation APIs via DataPrism’s plugin interfaces (JavaScript/TypeScript bindings)[2][3].
  - Support reading and writing XLSX files (import/export of spreadsheet data and formulas)[2][8].

- **Formula Support**
  - Evaluate cell, range, and sheet-level formulas using IronCalc’s engine.
  - Support at least 180+ Excel-compatible functions initially; extend to 300+ as IronCalc matures[3][8][7].
  - Enable use of arrays and (eventually) dynamic arrays when available[8].
  - Provide mechanisms for formula auditing and error tracing in DataPrism.

- **DataPrism Plugin API**
  - Register IronCalc as an `IDataProcessorPlugin` and `IUtilityPlugin`.
  - Expose key methods: `evaluateFormula()`, `setCellValue()`, `getCellValue()`, `registerCustomFunction()`.
  - Support plugin events for recomputation, dependency tracking, and batch calculations.

- **Interoperability & Extensibility**
  - Allow other DataPrism plugins (e.g., visualization, ML) to consume formula-calculated columns.
  - Provide hooks/APIs for registering custom formulas and business logic extensions.
  - Maintain compatibility with IronCalc’s XLSX import/export and internationalization roadmap[8][3].
  - Plans for future features: pivot tables, merged cells, name manager (as IronCalc reaches 1.0)[8][7].

---

## 4. Non-Functional Requirements

- **Performance**
  - In-browser spreadsheet calculations for at least 100k cells with sub-second latency on modern hardware[3][7].
  - WASM bundle size <5MB compressed for optimal load time.

- **Security**
  - Enforce Rust/WASM memory sandboxing for formula operations[1][3].
  - No remote code execution; all formula evaluation runs locally in the browser[3][8].

- **Maintainability**
  - Version pinning for IronCalc until it reaches stable 1.0 release[7][8].
  - Documentation for plugin API and integration points.
  - Automated tests for formula correctness, regression, and integration.

- **Compatibility**
  - Cross-browser support (Chrome, Firefox, Safari, Edge, latest 2 versions).
  - Internationalization support as provided by IronCalc (locale, time zone).

---

## 5. Quality Assurance

- **Automated Testing**
  - Run IronCalc’s internal test suite as part of DataPrism CI[2][8].
  - Add DataPrism-side tests for formula evaluation accuracy, error handling, and edge cases.
  - Validate XLSX round-trip import/export with randomly generated formulas.

- **Manual QA Checklist**
  - Confirm performant formula evaluation in large sample workbooks.
  - Validate Excel compatibility for high-use formulas (SUM, AVERAGE, IF, VLOOKUP, etc.).
  - Test integration workflows with DataPrism visualization and data connectors.

---

## 6. Deliverables

- DataPrism plugin that embeds and exposes IronCalc core for formula evaluation.
- API documentation and integration guide for third-party plugin authors.
- Demo apps and test sheets exercising all supported functions.
- Documentation on version management and update/release protocol.

---

## 7. Success Criteria

- All core IronCalc functions are accessible and usable in DataPrism workbooks.
- Automated and manual tests pass for integration, accuracy, and performance.
- DataPrism plugins and UI can consume formula-calculated columns seamlessly.
- Plugin users can update, audit, and extend formula functionality without core changes.

---

## 8. References

- [1] https://news.ycombinator.com/item?id=39218186
- [2] https://github.com/ironcalc/IronCalc
- [3] https://www.ironcalc.com
- [7] https://blog.ironcalc.com/2024/11/06/IronCalc-1.0.html
- [8] https://github.com/ironcalc

---

**How to Use This PRP**

1. Copy to your `/PRPs` directory in the DataPrism project.
2. Edit for specific IronCalc/API version and DataPrism plugin interface details.
3. Apply with the plugin development workflow to scaffold and validate the integration.

