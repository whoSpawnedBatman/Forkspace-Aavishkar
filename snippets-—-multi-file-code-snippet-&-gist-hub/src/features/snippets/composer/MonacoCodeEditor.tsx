import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import * as React from 'react';

// Configure all Monaco language workers locally with zero external CDN requests
if (typeof self !== 'undefined') {
  const globalScope = self as unknown as {
    MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
  };
  globalScope.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') {
        return new jsonWorker();
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker();
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker();
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };
}

loader.config({ monaco });

function mapToMonacoLanguage(lang?: string): string {
  switch (lang) {
    case 'tsx':
    case 'typescript':
      return 'typescript';
    case 'jsx':
    case 'javascript':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'markdown':
      return 'markdown';
    case 'yaml':
      return 'yaml';
    case 'bash':
      return 'shell';
    case 'python':
      return 'python';
    case 'sql':
      return 'sql';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
}

export interface MonacoDraftFile {
  id: string;
  path: string;
  language: string;
  text: string;
}

interface MonacoCodeEditorProps {
  files: readonly MonacoDraftFile[];
  activeFileId: string;
  readOnly?: boolean;
  onChange: (fileId: string, nextValue: string) => void;
  onLoadError: () => void;
}

export default function MonacoCodeEditor({
  files,
  activeFileId,
  readOnly = false,
  onChange,
  onLoadError,
}: MonacoCodeEditorProps) {
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = React.useRef<Map<string, monaco.editor.ITextModel>>(new Map());
  const suppressingChangeRef = React.useRef(false);
  const activeFileIdRef = React.useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0];

  const getOrCreateModel = React.useCallback((file: MonacoDraftFile) => {
    const existing = modelsRef.current.get(file.id);
    const monacoLang = mapToMonacoLanguage(file.language);
    if (existing && !existing.isDisposed()) {
      if (existing.getLanguageId() !== monacoLang) {
        monaco.editor.setModelLanguage(existing, monacoLang);
      }
      // Normalize line endings before comparing so typing never triggers a cursor-resetting setValue
      const normalizedModelVal = existing.getValue().replace(/\r\n/g, '\n');
      const normalizedPropVal = file.text.replace(/\r\n/g, '\n');
      if (normalizedModelVal !== normalizedPropVal) {
        suppressingChangeRef.current = true;
        existing.setValue(file.text);
        suppressingChangeRef.current = false;
      }
      return existing;
    }

    const uri = monaco.Uri.parse(`inmemory://snippets/${file.id}`);
    const priorByUri = monaco.editor.getModel(uri);
    const model =
      priorByUri && !priorByUri.isDisposed()
        ? priorByUri
        : monaco.editor.createModel(file.text, monacoLang, uri);

    if (model.getValue() !== file.text) {
      suppressingChangeRef.current = true;
      model.setValue(file.text);
      suppressingChangeRef.current = false;
    }
    modelsRef.current.set(file.id, model);
    return model;
  }, []);

  // Dispose models for removed files
  React.useEffect(() => {
    const activeIds = new Set(files.map((f) => f.id));
    for (const [id, model] of modelsRef.current.entries()) {
      if (!activeIds.has(id)) {
        if (!model.isDisposed()) {
          model.dispose();
        }
        modelsRef.current.delete(id);
      }
    }
  }, [files]);

  // Synchronize active file model & language without remounting editor
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeFile) return;
    const model = getOrCreateModel(activeFile);
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }
  }, [activeFile, getOrCreateModel]);

  // Dispose all models on composer unmount
  React.useEffect(() => {
    return () => {
      for (const model of modelsRef.current.values()) {
        if (!model.isDisposed()) {
          model.dispose();
        }
      }
      modelsRef.current.clear();
    };
  }, []);

  const handleMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    if (activeFile) {
      const model = getOrCreateModel(activeFile);
      editor.setModel(model);
    }

    editor.onDidChangeModelContent(() => {
      if (suppressingChangeRef.current) return;
      const currentModel = editor.getModel();
      if (!currentModel) return;
      onChangeRef.current(activeFileIdRef.current, currentModel.getValue());
    });
  };

  if (!activeFile) return null;

  return (
    <div className="code-surface-focus overflow-hidden bg-[var(--code-surface)]">
      <Editor
        height="420px"
        theme="snippets-dark"
        onMount={handleMount}
        onValidate={() => {}}
        loading={
          <div className="flex h-[420px] items-center justify-center bg-[var(--code-surface)] text-xs font-mono text-[var(--code-muted)]">
            Loading editor…
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13.5,
          lineHeight: 22,
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'off',
          padding: { top: 14, bottom: 14 },
          ariaLabel: `Code editor for ${activeFile.path || 'untitled file'}`,
          renderLineHighlight: 'line',
          overviewRulerBorder: false,
        }}
        beforeMount={(m) => {
          try {
            m.editor.defineTheme('snippets-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#1d1d1f',
                'editor.foreground': '#f5f5f7',
                'editorLineNumber.foreground': '#7c7c81',
                'editorLineNumber.activeForeground': '#d2d2d7',
                'editor.lineHighlightBackground': '#28282c',
                'editorCursor.foreground': '#8fc6ff',
                'editor.selectionBackground': '#0071e344',
              },
            });
          } catch {
            onLoadError();
          }
        }}
      />
    </div>
  );
}
