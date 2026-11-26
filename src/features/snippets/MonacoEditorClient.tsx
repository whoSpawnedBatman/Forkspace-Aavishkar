"use client";

import * as monaco from "monaco-editor";
import { Editor, loader } from "@monaco-editor/react";

loader.config({ monaco });

if (typeof window !== "undefined") {
  window.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === "typescript" || label === "javascript") {
        return new Worker(
          new URL(
            "../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }

      return new Worker(
        new URL(
          "../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js",
          import.meta.url,
        ),
        { type: "module" },
      );
    },
  };
}

export function MonacoEditorClient({
  path,
  language,
  value,
  disabled,
  onChange,
}: {
  path: string;
  language: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Editor
      path={path}
      language={language}
      value={value}
      theme="vs-dark"
      keepCurrentModel
      height="100%"
      onChange={(nextValue) => onChange(nextValue ?? "")}
      options={{
        ariaLabel: `Code editor for ${path}`,
        automaticLayout: true,
        readOnly: disabled,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontSize: 13,
        lineHeight: 21,
        tabSize: 2,
        wordWrap: "off",
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: "gutter",
      }}
    />
  );
}
