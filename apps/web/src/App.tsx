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
import { GoBoardView, ShogiBoardView } from "./Boards";
import { OnlineClient } from "./online";

type Screen = "menu" | "rules" | "tutorial" | "play";

const HAND_LABEL: Record<HandKind, string> = {
  gold: "金",
  silver: "銀",
  knight: "桂",
  pawn: "歩",
};

const TUTORIAL_STEPS = [
  "囲碁側が先手。空き点をタップして「打つ」で黒石を置きます。",
  "白石を囲んで取ると圧力が溜まり、将棋盤へ侵攻駒が落ちます。",
  "将棋は駒を選んで動かします。侵攻駒を取ると歩が手に入り、囲碁盤へ白石が落ちます。",
  "圧力が3以上なら「圧力解放」で大きく干渉できます。勝利条件はルール画面へ。",
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
        ? "チュートリアル：まずは囲碁盤の中央付近に打ちましょう"
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
    if (action.type === "go_place" || action.type === "go_pass" || action.type === "go_release") {
      setGoPreview(null);
    }
    if (tutorialMode && result.ok) {
      if (
        action.type === "go_place" ||
        action.type === "shogi_move" ||
        action.type === "go_release" ||
        action.type === "shogi_release"
      ) {
        advanceTutorial();
      }
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

  const createOnline = async () => {
    setOnlineStatus("接続中…");
    const client = new OnlineClient();
    clientRef.current = client;
    try {
      const onMsg = (msg: import("./online").OnlineMessage) => {
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
      };
      await client.connect(onMsg);
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
    clientRef.current = client;
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
          <p>囲碁の包囲と将棋の切り込みが、相手の盤へ干渉する非対称バトル。</p>
        </header>
        <div className="menu">
          <fieldset className="handicap-box">
            <legend>ハンデ（ローカル／CPU）</legend>
            <div className="handicap-row" role="radiogroup" aria-label="ハンデ">
              {handicapOptions().map((preset) => (
                <label key={preset.id} className={`handicap-chip${handicap === preset.id ? " active" : ""}`}>
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
            <p className="muted handicap-desc">{HANDICAP_PRESETS[handicap].description}</p>
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
          <h3>基本</h3>
          <p>
            囲碁側（黒）は 9×9 に石を打ち、白石を取ります。将棋側は 5×5
            で自駒を動かし、侵攻駒を取ります。取った数が相手盤への妨害になります。
          </p>
          <h3>干渉</h3>
          <p>
            囲碁が白を2個以上取ると将棋盤に動かない「侵攻駒」が落ちます。将棋が侵攻駒を取ると囲碁盤に白石が落ちます。圧力ゲージが溜まると解放できます。
          </p>
          <h3>勝利</h3>
          <p>
            囲碁は白石累計6捕獲（ハンデで変動）、または将棋が合法手を失ったとき。将棋は侵攻駒4捕獲（取ると歩が手に入る／ハンデで変動）、または一度広がった黒石が大きく減ったとき。
          </p>
          <h3>ハンデ</h3>
          <p>
            メニューの「囲碁有利／将棋有利」で勝利条件や持ち駒を変えられます。オンラインは常に互角です。
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

  const onGoPick = (at: Coord) => {
    if (!goActive) return;
    setGoPreview(at);
  };

  const confirmGo = () => {
    if (!goPreview) return;
    dispatch({ type: "go_place", at: goPreview });
  };

  const onShogiCell = (at: Coord) => {
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
          捕獲 {state.goCaptures}/{state.config.goWinCaptures}
          <br />
          圧力 {state.goPressure}/{state.config.pressureMax}
        </div>
        <div className="hud-card shogi">
          <strong>将棋</strong>
          侵捕 {state.shogiInvaderCaptures}/{state.config.shogiWinInvaderCaptures}
          <br />
          圧力 {state.shogiPressure}/{state.config.pressureMax}
        </div>
      </div>

      <div className={`turn-banner ${state.activeSide}`}>
        手番：{sideLabel(state.activeSide)}
        {state.mode === "online" && roomId ? ` ／ 部屋 ${roomId}` : ""}
        {state.mode === "online" && mySide ? ` ／ あなたは${sideLabel(mySide)}` : ""}
        {state.mode !== "online" ? ` ／ ${HANDICAP_PRESETS[handicap].label}` : ""}
      </div>

      {message && <div className="muted">{message}</div>}

      <div className={`boards focus-${state.activeSide}`}>
        <section
          className={`panel go-panel${state.activeSide === "go" ? " active" : ""}`}
        >
          <h2>
            囲碁盤 <span>9×9</span>
          </h2>
          <GoBoardView
            state={state}
            preview={goPreview}
            onPick={onGoPick}
            interactive={goActive}
            hideContent={hideForPass}
          />
        </section>
        <section
          className={`panel shogi-panel${state.activeSide === "shogi" ? " active" : ""}`}
        >
          <h2>
            将棋盤 <span>5×5</span>
          </h2>
          <ShogiBoardView
            state={state}
            onCell={onShogiCell}
            interactive={shogiActive}
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
      </div>

      <div className="actions">
        {state.activeSide === "go" && goActive && (
          <>
            <button
              type="button"
              className="confirm-btn"
              disabled={!goPreview}
              onClick={confirmGo}
            >
              打つ
            </button>
            <button type="button" className="ghost-btn" onClick={() => dispatch({ type: "go_pass" })}>
              パス
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={state.goPressure < state.config.pressureReleaseAt}
              onClick={() => dispatch({ type: "go_release" })}
            >
              圧力解放
            </button>
          </>
        )}
        {state.activeSide === "shogi" && shogiActive && (
          <>
            <button
              type="button"
              className="ghost-btn"
              disabled={state.shogiPressure < state.config.pressureReleaseAt}
              onClick={() => dispatch({ type: "shogi_release" })}
            >
              圧力解放
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => dispatch({ type: "clear_selection" })}
            >
              選択解除
            </button>
          </>
        )}
        {mySide || state.mode !== "online" ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              dispatch({
                type: "resign",
                side:
                  state.mode === "online" && mySide
                    ? mySide
                    : state.activeSide,
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
            <p className="muted">黒白侵攻 — Kuroshiro</p>
            <div className="menu" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="primary"
                onClick={() => startLocal(state.mode === "online" ? "hotseat" : state.mode)}
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
