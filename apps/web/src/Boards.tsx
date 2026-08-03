import type { ReactNode } from "react";
import { pieceLabel, type Coord, type GameState, type GoStone } from "@kuroshiro/engine";

interface GoBoardProps {
  state: GameState;
  preview: Coord | null;
  onPick: (at: Coord) => void;
  interactive: boolean;
  hideContent?: boolean;
}

export function GoBoardView({
  state,
  preview,
  onPick,
  interactive,
  hideContent,
}: GoBoardProps) {
  const size = state.config.goSize;
  const cells: ReactNode[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const stone = state.goBoard[row][col];
      const isPreview =
        preview &&
        preview.row === row &&
        preview.col === col &&
        !stone &&
        interactive;
      cells.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className="go-cell"
          aria-label={`${row + 1},${col + 1}`}
          disabled={!interactive}
          onClick={() => onPick({ row, col })}
        >
          {!hideContent && stone && <span className={`stone ${stone as GoStone}`} />}
          {!hideContent && isPreview && <span className="stone black ghost" />}
        </button>,
      );
    }
  }
  return (
    <div className="go-board" style={{ ["--cells" as string]: size }}>
      {cells}
    </div>
  );
}

interface ShogiBoardProps {
  state: GameState;
  onCell: (at: Coord) => void;
  interactive: boolean;
  hideContent?: boolean;
}

export function ShogiBoardView({
  state,
  onCell,
  interactive,
  hideContent,
}: ShogiBoardProps) {
  const size = state.config.shogiSize;
  const cells: ReactNode[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const piece = state.shogiBoard[row][col];
      const selected =
        state.selectedShogi?.row === row && state.selectedShogi?.col === col;
      const legal = state.legalShogiTargets.some(
        (t) => t.row === row && t.col === col,
      );
      cells.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className={`shogi-cell${selected ? " selected" : ""}${legal ? " legal" : ""}`}
          disabled={!interactive}
          onClick={() => onCell({ row, col })}
        >
          {!hideContent && piece && (
            <span className={`piece${piece.kind === "invader" ? " invader" : ""}`}>
              {pieceLabel(piece.kind)}
            </span>
          )}
        </button>,
      );
    }
  }
  return (
    <div className="shogi-board" style={{ ["--cells" as string]: size }}>
      {cells}
    </div>
  );
}
