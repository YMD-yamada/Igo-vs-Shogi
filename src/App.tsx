import { useMemo, useState } from "react";
import { createInitialState, getScores, playIgoMove, playShogiMove, resetGame } from "./game";
import type { Coord, GameState, IgoStone, Player, ShogiCell, ShogiPieceKind } from "./types";

const playerLabel: Record<Player, string> = {
  igo: "囲碁陣営",
  shogi: "将棋陣営",
};

const pieceLabel: Record<ShogiPieceKind, string> = {
  king: "玉",
  gold: "金",
  silver: "銀",
  pawn: "歩",
  invader: "敵",
};

const igoLabel: Record<IgoStone, string> = {
  black: "●",
  white: "○",
};

const canIgoClick = (state: GameState, row: number, col: number): boolean =>
  !state.winner && state.activePlayer === "igo" && state.igoBoard[row][col] === null;

const shogiCellText = (cell: ShogiCell): string => {
  if (!cell) {
    return "";
  }
  return pieceLabel[cell.kind];
};

function App() {
  const [state, setState] = useState<GameState>(createInitialState());
  const [message, setMessage] = useState("囲碁側から開始します。");
  const [selected, setSelected] = useState<Coord | null>(null);
  const scores = useMemo(() => getScores(state), [state]);

  const onIgoClick = (row: number, col: number) => {
    if (!canIgoClick(state, row, col)) {
      return;
    }
    const result = playIgoMove(state, { row, col });
    setState(result.state);
    setSelected(null);
    setMessage(result.message);
  };

  const onShogiCellClick = (row: number, col: number) => {
    if (state.winner || state.activePlayer !== "shogi") {
      return;
    }

    if (!selected) {
      const piece = state.shogiBoard[row][col];
      if (!piece || piece.owner !== "shogi") {
        setMessage("将棋側は自駒を選択してください。");
        return;
      }
      setSelected({ row, col });
      setMessage("移動先を選んでください。");
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      setMessage("選択を解除しました。");
      return;
    }

    const result = playShogiMove(state, selected, { row, col });
    setState(result.state);
    setSelected(null);
    setMessage(result.message);
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>囲碁 vs 将棋 非対称バトル</h1>
          <p className="subtitle">ぷよテト風に、別ルール同士で妨害を送り合う対戦。</p>
        </div>
        <div className="status">
          <span className="badge">ターン {state.turn}</span>
          <span className={`badge turn-${state.activePlayer}`}>
            手番: {playerLabel[state.activePlayer]}
          </span>
          <span className="badge">囲碁 {scores.igo.total} - 将棋 {scores.shogi.total}</span>
        </div>
      </header>

      <section className="boards">
        <article className="panel">
          <h2>囲碁盤 (9x9)</h2>
          <div className="board board-igo">
            {state.igoBoard.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  className="cell igo-cell"
                  disabled={!canIgoClick(state, rowIndex, colIndex)}
                  onClick={() => onIgoClick(rowIndex, colIndex)}
                >
                  {cell ? <span className={`stone ${cell}`}>{igoLabel[cell]}</span> : ""}
                </button>
              )),
            )}
          </div>
          {state.pendingIgoHazards > 0 ? (
            <p className="danger">次の囲碁ターン開始時に白石 {state.pendingIgoHazards} 個が落下</p>
          ) : null}
        </article>

        <article className="panel">
          <h2>将棋盤 (5x5)</h2>
          <div className="board board-shogi">
            {state.shogiBoard.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    className={`cell shogi-cell ${isSelected ? "selected" : ""}`}
                    onClick={() => onShogiCellClick(rowIndex, colIndex)}
                  >
                    <span className={cell ? `piece ${cell.owner}` : undefined}>
                      {shogiCellText(cell)}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
          {state.pendingShogiHazards > 0 ? (
            <p className="danger">次の将棋ターン開始時に味方駒 {state.pendingShogiHazards} 枚が消去</p>
          ) : null}
        </article>
      </section>

      <section className="panel score-grid">
        <article>
          <h3>囲碁側</h3>
          <ul>
            <li>盤面石: {scores.igo.stones}</li>
            <li>捕獲数: {scores.igo.captures}</li>
            <li>送った妨害: {scores.igo.sentHazards}</li>
            <li>受けた妨害: {scores.igo.receivedHazards}</li>
            <li>総合: {scores.igo.total}</li>
          </ul>
        </article>
        <article>
          <h3>将棋側</h3>
          <ul>
            <li>盤面駒: {scores.shogi.pieces}</li>
            <li>捕獲数: {scores.shogi.captures}</li>
            <li>送った妨害: {scores.shogi.sentHazards}</li>
            <li>受けた妨害: {scores.shogi.receivedHazards}</li>
            <li>総合: {scores.shogi.total}</li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <strong>メッセージ:</strong> {message}
        <div className="controls">
          <button
            type="button"
            onClick={() => {
              setState(resetGame());
              setSelected(null);
              setMessage("新しい対局を開始しました。");
            }}
          >
            リセット
          </button>
        </div>
        <div className="logs">
          <ol>
            {state.log.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        </div>
      </section>

      {state.winner ? (
        <section className="winner">
          勝者: {state.winner === "draw" ? "引き分け" : playerLabel[state.winner]}
        </section>
      ) : null}
    </main>
  );
}

export default App;
