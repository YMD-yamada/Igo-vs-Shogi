import { useEffect, useRef, useState } from "react";
import {
  applyAction,
  createInitialState,
  createMatchRecorder,
  finalizeMatchLog,
  HANDICAP_PRESETS,
  handicapOptions,
  recordAction,
  runCpuTurn,
  sideLabel,
  type Action,
  type Coord,
  type GameMode,
  type GameState,
  type HandicapId,
  type HandKind,
  type MatchRecorder,
  type Side,
} from "@kuroshiro/engine";
import { SharedBoardView } from "./Boards";
import { OnlineClient } from "./online";
import {
  downloadMatchLogs,
  saveMatchLog,
  summarizeLocalLogs,
  tryUploadMatchLog,
} from "./matchLogStore";

type Screen = "menu" | "rules" | "tutorial" | "play" | "logs";

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
  "囲碁は駒2枚捕獲、将棋は石6個捕獲が基本の勝利条件です。ハンデで変えられます。",
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
  /** Side the CPU plays (human plays the other). */
  const [cpuPlays, setCpuPlays] = useState<Side>("shogi");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialMode, setTutorialMode] = useState(false);
  const [logSummary, setLogSummary] = useState(() => summarizeLocalLogs());
  const clientRef = useRef<OnlineClient | null>(null);
  const modeRef = useRef<GameMode>("hotseat");
  const recorderRef = useRef<MatchRecorder | null>(null);
  const persistedLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => clientRef.current?.close();
  }, []);

  useEffect(() => {
    if (!state || state.mode !== "cpu" || state.winner || state.passCurtain) return;
    if (state.cpuSide && state.activeSide === state.cpuSide) {
      const timer = window.setTimeout(() => {
        setState((prev) => {
          if (!prev) return prev;
          return runCpuTurn(prev, recorderRef.current ?? undefined);
        });
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

  useEffect(() => {
    if (!state?.winner || !recorderRef.current) return;
    if (persistedLogIdRef.current) return;
    // Online matches are persisted by the server with full plies
    if (state.mode === "online") {
      persistedLogIdRef.current = "online-server";
      return;
    }
    const log = finalizeMatchLog(recorderRef.current, state);
    if (!log) return;
    persistedLogIdRef.current = log.id;
    saveMatchLog(log);
    setLogSummary(summarizeLocalLogs());
    void tryUploadMatchLog(log);
  }, [state?.winner, state]);

  const beginRecorder = (
    next: GameState,
    opts: { handicapId?: HandicapId; humanSide?: Side | null; roomId?: string },
  ) => {
    recorderRef.current = createMatchRecorder({
      state: next,
      handicapId: opts.handicapId,
      humanSide: opts.humanSide,
      roomId: opts.roomId,
      tags: [next.mode],
      appVersion: "1.0.0",
    });
    persistedLogIdRef.current = null;
  };

  const startLocal = (
    mode: GameMode,
    opts?: { tutorial?: boolean; handicapId?: HandicapId; cpuPlaysSide?: Side },
  ) => {
    modeRef.current = mode;
    clientRef.current?.close();
    clientRef.current = null;
    setMySide(null);
    setRoomId("");
    const hid = opts?.handicapId ?? handicap;
    if (opts?.handicapId) setHandicap(opts.handicapId);
    const preset = HANDICAP_PRESETS[hid];
    const cpuSide =
      mode === "cpu" ? (opts?.cpuPlaysSide ?? cpuPlays) : null;
    if (opts?.cpuPlaysSide) setCpuPlays(opts.cpuPlaysSide);
    const humanSide =
      mode === "cpu" ? (cpuSide === "go" ? "shogi" : "go") : null;
    const next = createInitialState(mode, {
      seed: Date.now() >>> 0,
      cpuSide,
      config: preset.config,
      startingHand: preset.startingHand,
      removeStartingPieces: preset.removeStartingPieces,
    });
    beginRecorder(next, { handicapId: hid, humanSide });
    setState(next);
    const tutorial = Boolean(opts?.tutorial);
    setTutorialMode(tutorial);
    setTutorialStep(0);
    setMessage(
      tutorial
        ? "チュートリアル：盤の中央付近に黒石を打ちましょう"
        : mode === "cpu"
          ? `あなたは${sideLabel(humanSide!)}／CPUは${sideLabel(cpuSide!)}（${preset.label}）`
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
    const side = state.activeSide;
    const from = state.selectedShogi ?? undefined;
    const handKind = state.selectedHand ?? undefined;
    const result = applyAction(state, action);
    if (result.ok && recorderRef.current) {
      recordAction(recorderRef.current, action, result.state, side, {
        from,
        handKind,
      });
    }
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
          beginRecorder(msg.state, {
            handicapId: "even",
            humanSide: msg.side,
            roomId: msg.roomId,
          });
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
      setOnlineStatus(
        "サーバーに接続できません。先に npm run dev:server を起動してください。",
      );
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
          beginRecorder(msg.state, {
            handicapId: "even",
            humanSide: msg.side,
            roomId: msg.roomId,
          });
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

          <fieldset className="handicap-box">
            <legend>CPUが持つ側</legend>
            <div className="handicap-row" role="radiogroup" aria-label="CPU側">
              {(
                [
                  { side: "shogi" as Side, label: "CPU=将棋（あなた囲碁）" },
                  { side: "go" as Side, label: "CPU=囲碁（あなた将棋）" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.side}
                  className={`handicap-chip${cpuPlays === opt.side ? " active" : ""}`}
                >
                  <input
                    type="radio"
                    name="cpuSide"
                    checked={cpuPlays === opt.side}
                    onChange={() => setCpuPlays(opt.side)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
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
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setLogSummary(summarizeLocalLogs());
              setScreen("logs");
            }}
          >
            対局ログ（{logSummary.total}）
          </button>
          <p className="muted legal-foot">
            <a href="https://ymd-portfolio-site.pages.dev/legal/privacy" rel="noopener noreferrer">
              プライバシー
            </a>
            {" · "}
            <a href="https://ymd-portfolio-site.pages.dev/legal/terms" rel="noopener noreferrer">
              利用規約
            </a>
            {" · "}
            <a href="https://ymd-portfolio-site.pages.dev/legal/support" rel="noopener noreferrer">
              サポート
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (screen === "logs") {
    return (
      <div className="app">
        <header className="brand">
          <h1>
            対局ログ
            <span className="en">Match logs</span>
          </h1>
          <p>軽量ログを貯めて、バランス改善の材料にします。</p>
        </header>
        <div className="rules">
          <p>
            端末内: <strong>{logSummary.total}</strong> 局
          </p>
          <p className="muted">
            モード {JSON.stringify(logSummary.byMode)} ／ 勝敗{" "}
            {JSON.stringify(logSummary.byWinner)}
          </p>
          <p>
            サーバー起動中は CPU 対局も自動アップロードされます。オンライン対局はサーバー側に保存されます。
          </p>
          <p className="muted">
            エージェントに「フィードバック適用」と伝えると、ログ集計から調整します。
          </p>
        </div>
        <div className="menu">
          <button
            type="button"
            className="primary"
            disabled={logSummary.total === 0}
            onClick={() => downloadMatchLogs()}
          >
            JSONLを書き出す
          </button>
          <button type="button" className="confirm-btn" onClick={() => setScreen("menu")}>
            戻る
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
            onClick={() =>
              startLocal("cpu", {
                tutorial: true,
                handicapId: "even",
                cpuPlaysSide: "shogi",
              })
            }
          >
            CPUで練習開始（あなた囲碁）
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
            自駒を動かし、黒石のマスへ進入すると石を取れます。取った石は歩の持ち駒になります。直後の石は歩になりません。桂は石を取れません。
          </p>
          <h3>勝利</h3>
          <p>
            囲碁：駒を累計2枚捕獲、または王捕獲／将棋合法手なし。将棋：黒石を累計6個捕獲。
          </p>
          <h3>モード</h3>
          <p>
            手渡し・CPU（どちら側も可）・オンライン。終局ログはバランス改善に使います。
          </p>
          <h3>ハンデ</h3>
          <p>
            メニューで互角／やや有利／有利を選べます。オンラインは常に互角です。
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
        {state.mode === "cpu" && state.cpuSide
          ? ` ／ CPU=${sideLabel(state.cpuSide)}`
          : ""}
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
            recorderRef.current = null;
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
            <p className="muted">対局ログを保存しました</p>
            <div className="menu" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="primary"
                onClick={() =>
                  startLocal(state.mode === "online" ? "cpu" : state.mode)
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
                  recorderRef.current = null;
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
