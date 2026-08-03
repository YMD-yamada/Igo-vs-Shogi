import type { ReactNode } from "react";
import {
  pieceLabel,
  type Coord,
  type GameState,
} from "@kuroshiro/engine";

interface BoardProps {
  state: GameState;
  preview: Coord | null;
  onPick: (at: Coord) => void;
  interactive: boolean;
  hideContent?: boolean;
}

export function SharedBoardView({
  state,
  preview,
  onPick,
  interactive,
  hideContent,
}: BoardProps) {
  const size = state.config.size;
  const cells: ReactNode[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = state.board[row][col];
      const selected =
        state.selectedShogi?.row === row && state.selectedShogi?.col === col;
      const legal = state.legalShogiTargets.some(
        (t) => t.row === row && t.col === col,
      );
      const isPreview =
        preview &&
        preview.row === row &&
        preview.col === col &&
        !cell &&
        interactive;

      cells.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className={`cell${selected ? " selected" : ""}${legal ? " legal" : ""}`}
          aria-label={`${row + 1},${col + 1}`}
          disabled={!interactive}
          onClick={() => onPick({ row, col })}
        >
          {!hideContent && cell?.type === "stone" && (
            <span className="stone black" />
          )}
          {!hideContent && cell?.type === "piece" && (
            <span
              className={`piece${cell.piece.kind === "king" ? " king" : ""}`}
            >
              {pieceLabel(cell.piece.kind)}
            </span>
          )}
          {!hideContent && isPreview && <span className="stone black ghost" />}
        </button>,
      );
    }
  }

  return (
    <div className="shared-board" style={{ ["--cells" as string]: size }}>
      {cells}
    </div>
  );
}
