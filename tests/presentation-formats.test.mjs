import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL(
    "../src/app/components/presentation/presentationFormats.ts",
    import.meta.url,
  ),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { presentationSections, sectionAt, PRESENTATION_FORMATS } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("formats share stable source sections while keeping their own navigation contract", () => {
  const slides = [
    { kind: "title", h1: "Review the result", kicker: "Result comparison" },
    {
      kind: "methods",
      h2: "Compare the recorded controls",
      kicker: "Methods",
      items: [],
    },
    { kind: "artifact", artifact: { title: "QC summary" }, idx: 0 },
  ];
  const sections = presentationSections({ id: "result-review" }, slides);
  assert.deepEqual(
    sections.map(({ id, label, title }) => ({ id, label, title })),
    [
      {
        id: "result-review-section-1",
        label: "Overview",
        title: "Review the result",
      },
      {
        id: "result-review-section-2",
        label: "Methods",
        title: "Compare the recorded controls",
      },
      {
        id: "result-review-section-3",
        label: "Artifact 1",
        title: "QC summary",
      },
    ],
  );
  assert.equal(sectionAt(1, sections).content, slides[1]);
  assert.equal(sectionAt(-1, sections), sections[0]);
  assert.equal(sectionAt(3, sections), sections[2]);
  assert.deepEqual(
    Object.values(PRESENTATION_FORMATS).map((format) => format.navigation),
    ["paged", "chapters", "contents"],
  );
});
