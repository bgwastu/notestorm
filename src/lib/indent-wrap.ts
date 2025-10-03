import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

const CharacterWidthEffect = StateEffect.define<number | null>();

const extraCycleCharacterWidth = StateField.define<number | null>({
	create() {
		return null;
	},
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(CharacterWidthEffect)) return effect.value;
		}
		return value;
	},
});

const characterWidthListener = EditorView.updateListener.of((viewupdate) => {
	const width = viewupdate.view.defaultCharacterWidth;
	const currentWidth = viewupdate.view.state.field(
		extraCycleCharacterWidth,
		false,
	);

	if (currentWidth !== width) {
		viewupdate.view.dispatch({
			effects: [CharacterWidthEffect.of(width)],
		});
	}
});

const ARBITRARY_INDENT_LINE_WRAP_LIMIT = 48;

const lineWrappingDecorations = StateField.define({
	create() {
		return Decoration.none;
	},
	update(deco, tr) {
		const tabSize = tr.state.tabSize;
		const charWidth = tr.state.field(extraCycleCharacterWidth, false);

		if (charWidth == null) return Decoration.none;
		if (!tr.docChanged && deco !== Decoration.none) return deco;

		const decorations = [];

		for (let i = 0; i < tr.state.doc.lines; i++) {
			const line = tr.state.doc.line(i + 1);
			if (line.length === 0) continue;

			let indentedChars = 0;
			for (const ch of line.text) {
				if (ch === "\t") {
					indentedChars = indentedChars + tabSize - (indentedChars % tabSize);
				} else if (ch === " ") {
					indentedChars++;
				} else {
					break;
				}
			}

			if (
				indentedChars > 0 &&
				indentedChars < ARBITRARY_INDENT_LINE_WRAP_LIMIT
			) {
				decorations.push(
					Decoration.line({
						attributes: {
							style: `text-indent: -${indentedChars}ch; padding-left: ${indentedChars}ch`,
						},
					}).range(line.from),
				);
			}
		}

		return Decoration.set(decorations);
	},
	provide: (f) => EditorView.decorations.from(f),
});

export const indentationWrap = [
	extraCycleCharacterWidth,
	characterWidthListener,
	lineWrappingDecorations,
];
