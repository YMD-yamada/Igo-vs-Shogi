import { useEffect, useRef, useState } from "react";
import {
  applyAction,
  createInitialState,
  HANDICAP_PRESETS,
  handicapOptions,
  runCpuTurn,
  sideLabel,
  type Action,
  type Coord,
  type GameMode,
  type GameState,
  type HandicapId,
  type HandKind,
  type Side,
} from "@kuroshiro/engine";
import { SharedBoardView } from "./Boards";
import { OnlineClient } from "./online";

type Screen = "menu" | "rules" | "tutorial" | "play";

const HAND_LABEL: Record<HandKind, string> = {
  gold: "金",
  silver: "銀",
  knight: "桂",
  pawn: "歩",
};

const TUTORIAL_STEPS = [
  "同じ 9×9 盤で戦います。囲碁は空き点に黒石を打ちます。",
  "将棋の駒は呼吸点（空き隣接）が0になると囲まれて取れます。王を取れば即勝ち。",
  "将棋は駒を動かして黒石の上に乗ると石を取れます。取った石は歩として打てます。",
  "囲碁は駒5枚捕獲、将棋は石10個捕獲が基本の勝利条件です。",
];

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [state, setState] = useState<GameState | null>(null);
  const [message, setMessage] = useState("");
  const [goPreview, setGoPreview] = useState<Coord | null>(null);
  const [mySide, setMySide] = useState<Side | null>(null);
  const [roomId, setRoomId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [onlineStatus, setOnlineStatus] = useState("");
  const [handicap, setHandicap] = useState<HandicapId>("even");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialMode, setTutorialMode] = useState(false);
  const clientRef = useRef<OnlineClient | null>(null);
  const modeRef = useRef<GameMode>("hotseat");

  useEffect(() => {
    return () => clientRef.current?.close();
  }, []);

  useEffect(() => {
    if (!state || state.mode !== "cpu" || state.winner || state.passCurtain) return;
    if (state.cpuSide && state.activeSide === state.cpuSide) {
      const timer = window.setTimeout(() => {
        setState((prev) => (prev ? runCpuTurn(prev) : prev));
        setMessage("CPUが着手しました");
        setGoPreview(null);
      }, 450);
      return () => window.clearTimeout(timer);
    }
  }, [state]);

  useEffect(() => {
    if (!state) return;
    if (state.activeSide !== "go") setGoPreview(null);
  }, [state?.activeSide, state?.turn]);

  const startLocal = (
    mode: GameMode,
    opts?: { tutorial?: boolean; handicapId?: HandicapId },
  ) => {
    modeRef.current = mode;
    clientRef.current?.close();
    clientRef.current = null;
    setMySide(null);
    setRoomId("");
    const hid = opts?.handicapId ?? handicap;
    if (opts?.handicapId) setHandicap(opts.handicapId);
    const preset = HANDICAP_PRESETS[hid];
    setState(
      createInitialState(mode, {
        seed: Date.now() >>> 0,
        cpuSide: "shogi",
        config: preset.config,
        startingHand: preset.startingHand,
      }),
    );
    const tutorial = Boolean(opts?.tutorial);
    setTutorialMode(tutorial);
    setTutorialStep(0);
    setMessage(
      tutorial
        ? "チュートリアル：盤の中央付近に黒石を打ちましょう"
        : mode === "cpu"
          ? `あなたは囲碁側です（${preset.label}）`
          : `端末を共有して対戦（${preset.label}）`,
    );
    setGoPreview(null);
    setScreen("play");
  };

  const advanceTutorial = () => {
    setTutorialStep((s) => Math.min(s + 1, TUTORIAL_STEPS.length - 1));
  };

  const dispatch = (action: Action) => {
    if (!state) return;
    if (state.mode === "online") {
      clientRef.current?.send({ type: "action", action });
      return;
    }
    const result = applyAction(state, action);
    setState(result.state);
    setMessage(result.message);
    if (action.type === "go_place" || action.type === "go_pass") {
      setGoPreview(null);
    }
    if (
      tutorialMode &&
      result.ok &&
      (action.type === "go_place" || action.type === "shogi_move")
    ) {
      advanceTutorial();
    }
  };

  const canControl = (side: Side): boolean => {
    if (!state || state.winner) return false;
    if (state.mode === "online") return mySide === side && state.activeSide === side;
    if (state.mode === "cpu") {
      return state.activeSide === side && side !== state.cpuSide;
    }
    return state.activeSide === side;
  };

  const bindOnline = (client: OnlineClient) => {
    clientRef.current = client;
  };

  const createOnline = async () => {
    setOnlineStatus("接続中…");
    const client = new OnlineClient();
    bindOnline(client);
    try {
      await client.connect((msg) => {
        if (msg.type === "created" || msg.type === "joined") {
          setRoomId(msg.roomId);
          setMySide(msg.side);
          setState(msg.state);
          setTutorialMode(false);
          setScreen("play");
          setOnlineStatus("");
          setMessage(
            msg.type === "created"
              ? `ルーム ${msg.roomId} を作成。相手の参加を待っています。`
              : `ルーム ${msg.roomId} に参加しました。`,
          );
        } else if (msg.type === "state") {
          setState(msg.state);
          setGoPreview(null);
          if (msg.lastMessage) setMessage(msg.lastMessage);
        } else if (msg.type === "error") {
          setOnlineStatus(msg.message);
          setMessage(msg.message);
        } else if (msg.type === "peer_left") {
          setMessage("相手が切断しました");
        }
      });
      modeRef.current = "online";
      client.send({ type: "create" });
    } catch {
      setOnlineStatus("サーバーに接続できません。先に npm run dev:server を起動してください。");
    }
  };

  const joinOnline = async () => {
    if (!joinCode.trim()) {
      setOnlineStatus("ルームコードを入力してください");
      return;
    }
    setOnlineStatus("接続中…");
    const client = new OnlineClient();
    bindOnline(client);
    try {
      await client.connect((msg) => {
        if (msg.type === "created" || msg.type === "joined") {
          setRoomId(msg.roomId);
          setMySide(msg.side);
          setState(msg.state);
          setTutorialMode(false);
          setScreen("play");
          setOnlineStatus("");
          setMessage(`ルーム ${msg.roomId} に参加（あなたは${sideLabel(msg.side)}）`);
        } else if (msg.type === "state") {
          setState(msg.state);
          setGoPreview(null);
          if (msg.lastMessage) setMessage(msg.lastMessage);
        } else if (msg.type === "error") {
          setOnlineStatus(msg.message);
          setMessage(msg.message);
        } else if (msg.type === "peer_left") {
          setMessage("相手が切断しました");
        }
      });
      modeRef.current = "online";
      client.send({ type: "join", roomId: joinCode.trim().toUpperCase() });
    } catch {
      setOnlineStatus("サーバーに接続できません。");
    }
  };

  if (screen === "menu") {
    return (
      <div className="app">
        <header className="brand">
          <h1>
            黒白侵攻
            <span className="en">Kuroshiro</span>
          </h1>
          <p>一つの盤で、囲碁の包囲と将棋の切り込みがぶつかる。</p>
        </header>
        <div className="menu">
          <fieldset className="handicap-box">
            <legend>ハンデ（ローカル／CPU）</legend>
            <div className="handicap-row" role="radiogroup" aria-label="ハンデ">
              {handicapOptions().map((preset) => (
                <label
                  key={preset.id}
                  className={`handicap-chip${handicap === preset.id ? " active" : ""}`}
                >
                  <input
                    type="radio"
                    name="handicap"
                    value={preset.id}
                    checked={handicap === preset.id}
                    onChange={() => setHandicap(preset.id)}
                  />
                  <span>{preset.label}</span>
                </label>
              ))}
            </div>
            <p className="muted handicap-desc">
              {HANDICAP_PRESETS[handicap].description}
            </p>
          </fieldset>
          <button type="button" className="primary" onClick={() => startLocal("hotseat")}>
            1台で対戦（手渡し）
          </button>
          <button type="button" className="secondary" onClick={() => startLocal("cpu")}>
            CPUと対戦
          </button>
          <button type="button" className="secondary" onClick={() => setScreen("tutorial")}>
            はじめて（チュートリアル）
          </button>
          <div className="online-box">
            <button type="button" className="secondary" onClick={() => void createOnline()}>
              オンライン部屋を作る
            </button>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ルームコード"
              maxLength={6}
              aria-label="ルームコード"
            />
            <button type="button" className="secondary" onClick={() => void joinOnline()}>
              コードで参加
            </button>
            {onlineStatus && <div className="muted">{onlineStatus}</div>}
          </div>
          <button type="button" className="secondary" onClick={() => setScreen("rules")}>
            ルール
          </button>
        </div>
      </div>
    );
  }

  if (screen === "tutorial") {
    return (
      <div className="app">
        <header className="brand">
          <h1>
            はじめて
            <span className="en">Tutorial</span>
          </h1>
          <p>短く覚えて、CPU戦で手を動かしてみましょう。</p>
        </header>
        <ol className="tutorial-list">
          {TUTORIAL_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="menu">
          <button
            type="button"
            className="primary"
            onClick={() => startLocal("cpu", { tutorial: true, handicapId: "even" })}
          >
            CPUで練習開始
          </button>
          <button type="button" className="secondary" onClick={() => setScreen("rules")}>
            ルール全文
          </button>
          <button type="button" className="ghost-btn" onClick={() => setScreen("menu")}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (screen === "rules") {
    return (
      <div className="app">
        <header className="brand">
          <h1>
            ルール
            <span className="en">How to play</span>
          </h1>
        </header>
        <div className="rules">
          <h3>一盤</h3>
          <p>
            9×9 の同じ盤に黒石と将棋駒が共存します。囲碁は石を打ち、将棋は駒を動かします。
          </p>
          <h3>囲碁</h3>
          <p>
            空き点に黒石を打ちます。将棋駒は隣接する空きがなくなると囲まれて取れます。王将を取ると即勝利。自殺手とコウは禁止です。
          </p>
          <h3>将棋</h3>
          <p>
            自駒を動かし、黒石のマスへ進入すると石を取れます。取った石は歩の持ち駒になります。駒同士は取れません。
          </p>
          <h3>勝利</h3>
          <p>
            囲碁：駒を累計5枚捕獲、または王捕獲／将棋合法手なし。将棋：黒石を累計10個捕獲（ハンデで変動）。
          </p>
        </div>
        <div className="menu">
          <button type="button" className="primary" onClick={() => setScreen("tutorial")}>
            チュートリアルへ
          </button>
          <button type="button" className="confirm-btn" onClick={() => setScreen("menu")}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const hideForPass = state.passCurtain && state.mode === "hotseat";
  const goActive = canControl("go");
  const shogiActive = canControl("shogi");
  const boardActive = goActive || shogiActive;

  const onCell = (at: Coord) => {
    if (goActive) {
      setGoPreview(at);
      return;
    }
    if (!shogiActive) return;
    if (state.selectedHand) {
      dispatch({ type: "shogi_drop", to: at });
      return;
    }
    if (state.selectedShogi) {
      const legal = state.legalShogiTargets.some(
        (t) => t.row === at.row && t.col === at.col,
      );
      if (legal) {
        dispatch({ type: "shogi_move", to: at });
        return;
      }
    }
    dispatch({ type: "shogi_select", at });
  };

  return (
    <div className="app">
      <header className="brand">
        <h1>
          黒白侵攻
          <span className="en">Kuroshiro</span>
        </h1>
      </header>

      {tutorialMode && (
        <div className="tutorial-banner" role="status">
          <strong>
            ガイド {tutorialStep + 1}/{TUTORIAL_STEPS.length}
          </strong>
          <p>{TUTORIAL_STEPS[tutorialStep]}</p>
          <button type="button" className="ghost-btn" onClick={() => setTutorialMode(false)}>
            ガイドを閉じる
          </button>
        </div>
      )}

      <div className="hud">
        <div className="hud-card go">
          <strong>囲碁</strong>
          駒取 {state.goCaptures}/{state.config.goWinCaptures}
        </div>
        <div className="hud-card shogi">
          <strong>将棋</strong>
          石取 {state.shogiStoneCaptures}/{state.config.shogiWinStones}
        </div>
      </div>

      <div className={`turn-banner ${state.activeSide}`}>
        手番：{sideLabel(state.activeSide)}
        {state.mode === "online" && roomId ? ` ／ 部屋 ${roomId}` : ""}
        {state.mode === "online" && mySide ? ` ／ あなたは${sideLabel(mySide)}` : ""}
        {state.mode !== "online" ? ` ／ ${HANDICAP_PRESETS[handicap].label}` : ""}
      </div>

      {message && <div className="muted">{message}</div>}

      <section className={`panel board-panel active`}>
        <h2>
          共有盤 <span>9×9</span>
        </h2>
        <SharedBoardView
          state={state}
          preview={goPreview}
          onPick={onCell}
          interactive={boardActive}
          hideContent={hideForPass}
        />
        <div className="hand-row">
          {(["gold", "silver", "knight", "pawn"] as HandKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`hand-chip${state.selectedHand === kind ? " active" : ""}`}
              disabled={!shogiActive || state.shogiHand[kind] <= 0}
              onClick={() => dispatch({ type: "shogi_select_hand", kind })}
            >
              {HAND_LABEL[kind]} ×{state.shogiHand[kind]}
            </button>
          ))}
        </div>
      </section>

      <div className="actions">
        {state.activeSide === "go" && goActive && (
          <>
            <button
              type="button"
              className="confirm-btn"
              disabled={!goPreview}
              onClick={() => goPreview && dispatch({ type: "go_place", at: goPreview })}
            >
              打つ
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => dispatch({ type: "go_pass" })}
            >
              パス
            </button>
          </>
        )}
        {state.activeSide === "shogi" && shogiActive && (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => dispatch({ type: "clear_selection" })}
          >
            選択解除
          </button>
        )}
        {mySide || state.mode !== "online" ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              dispatch({
                type: "resign",
                side: state.mode === "online" && mySide ? mySide : state.activeSide,
              })
            }
          >
            投了
          </button>
        ) : null}
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            clientRef.current?.close();
            setTutorialMode(false);
            setScreen("menu");
            setState(null);
          }}
        >
          メニュー
        </button>
      </div>

      <div className="log">
        {state.log.map((line, i) => (
          <div key={`${i}-${line}`}>{line}</div>
        ))}
      </div>

      {state.passCurtain && state.mode === "hotseat" && (
        <div className="curtain">
          <div>
            <h2>端末を渡してね</h2>
            <p>次は {sideLabel(state.activeSide)} の番です</p>
            <button type="button" onClick={() => dispatch({ type: "dismiss_curtain" })}>
              受け取った
            </button>
          </div>
        </div>
      )}

      {state.winner && (
        <div className="overlay-result">
          <div className="result-card">
            <h2>
              {state.winner === "draw"
                ? "引き分け"
                : `${sideLabel(state.winner)}の勝ち`}
            </h2>
            <p className="muted">黒白侵攻 — 一盤戦</p>
            <div className="menu" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="primary"
                onClick={() =>
                  startLocal(state.mode === "online" ? "hotseat" : state.mode)
                }
              >
                もう一度
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  clientRef.current?.close();
                  setTutorialMode(false);
                  setScreen("menu");
                  setState(null);
                }}
              >
                メニューへ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
