import type { EditorState, StateField } from "@codemirror/state";
import { get, set } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";

type EditorStateJSON = ReturnType<EditorState["toJSON"]>;

export type InitialStateConfig = {
  json: EditorStateJSON;
  fields: Record<string, StateField<unknown>>;
};

export function useEditorPersistence(
  storageKey: string,
  fields: Record<string, StateField<unknown>>,
) {
  const [value, setValue] = useState("");
  const [initialState, setInitialState] = useState<
    InitialStateConfig | undefined
  >(undefined);
  const [isReady, setIsReady] = useState(false);

  const persistState = useCallback(
    (state: EditorState) => {
      const json = state.toJSON(fields);
      set(storageKey, json).catch(() => {});
    },
    [fields, storageKey],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await get<EditorStateJSON>(storageKey);
        if (cancelled) {
          return;
        }
        if (saved) {
          setInitialState({ json: saved, fields });
          const doc = typeof saved.doc === "string" ? saved.doc : "";
          setValue(doc);
        }
      } catch {
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fields, storageKey]);

  return { value, setValue, initialState, isReady, persistState };
}
